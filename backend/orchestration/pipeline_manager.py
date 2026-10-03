"""
StrokeAegis AI — Pipeline Orchestration Manager
Manages pipeline runs, real-time SSE event dispatching, and thread-safe execution.
"""

import sys
import json
import uuid
import asyncio
import logging
import threading
from typing import Dict, Any, Optional, AsyncGenerator
from collections import defaultdict

from backend.agents.schemas import AgentProgressEvent
from backend.crew.flow import StrokeAegisClinicalFlow

logger = logging.getLogger("strokeaegis.orchestration")
logger.setLevel(logging.INFO)


class PipelineInstance:
    """Represents an active or completed clinical pipeline execution."""
    def __init__(self, pipeline_id: str, flow: StrokeAegisClinicalFlow):
        self.pipeline_id = pipeline_id
        self.flow = flow
        self.events: list[AgentProgressEvent] = []
        self.subscribers: list[asyncio.Queue] = []
        self.result: Optional[Dict[str, Any]] = None
        self.is_done: bool = False
        self.error: Optional[str] = None
        self.lock = threading.Lock()

    def dispatch_event(self, event: AgentProgressEvent):
        with self.lock:
            self.events.append(event)
            # Push to any active async SSE queues
            for q in list(self.subscribers):
                try:
                    q.put_nowait(event)
                except Exception:
                    pass

    def add_subscriber(self, q: asyncio.Queue):
        with self.lock:
            # Replay previous events
            for e in self.events:
                try:
                    q.put_nowait(e)
                except Exception:
                    pass
            self.subscribers.append(q)

    def remove_subscriber(self, q: asyncio.Queue):
        with self.lock:
            if q in self.subscribers:
                self.subscribers.remove(q)


class PipelineManager:
    """Singleton pipeline coordinator for FastAPI."""
    def __init__(self):
        self.pipelines: Dict[str, PipelineInstance] = {}
        self.lock = threading.Lock()

    def create_and_start_pipeline(
        self,
        patient_data: Dict[str, Any],
        ct_image_bytes: Optional[bytes] = None,
        ml_risk_engine=None,
        gate_engine=None,
        stroke_cls_engine=None
    ) -> str:
        pipeline_id = f"sa-{uuid.uuid4().hex[:8]}"

        def event_callback(event: AgentProgressEvent):
            instance = self.pipelines.get(pipeline_id)
            if instance:
                instance.dispatch_event(event)

        flow = StrokeAegisClinicalFlow(
            patient_data=patient_data,
            ct_image_bytes=ct_image_bytes,
            ml_risk_engine=ml_risk_engine,
            gate_engine=gate_engine,
            stroke_cls_engine=stroke_cls_engine,
            event_listener=event_callback,
            pipeline_id=pipeline_id
        )

        instance = PipelineInstance(pipeline_id, flow)
        with self.lock:
            self.pipelines[pipeline_id] = instance

        # Run flow in background thread so HTTP response returns immediately for SSE
        thread = threading.Thread(
            target=self._run_flow_thread,
            args=(instance,),
            daemon=True
        )
        thread.start()

        return pipeline_id

    def _run_flow_thread(self, instance: PipelineInstance):
        try:
            logger.info(f"Starting execution thread for pipeline: {instance.pipeline_id}")
            result = instance.flow.kickoff()
            with instance.lock:
                instance.result = instance.flow.state.report_result
                instance.is_done = True
            logger.info(f"Pipeline {instance.pipeline_id} finished successfully.")
        except Exception as e:
            logger.error(f"Pipeline {instance.pipeline_id} failed in thread: {e}", exc_info=True)
            with instance.lock:
                instance.error = str(e)
                instance.is_done = True
                instance.dispatch_event(
                    AgentProgressEvent(
                        pipeline_id=instance.pipeline_id,
                        agent="pipeline",
                        status="failed",
                        message=f"Pipeline error: {str(e)}"
                    )
                )

    def get_instance(self, pipeline_id: str) -> Optional[PipelineInstance]:
        with self.lock:
            return self.pipelines.get(pipeline_id)

    async def sse_event_generator(self, pipeline_id: str) -> AsyncGenerator[str, None]:
        """Async generator yielding SSE formatted events."""
        instance = self.get_instance(pipeline_id)
        if not instance:
            yield f"data: {json.dumps({'error': 'Pipeline not found'})}\n\n"
            return

        queue = asyncio.Queue()
        instance.add_subscriber(queue)

        try:
            while True:
                try:
                    event: AgentProgressEvent = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {json.dumps(event.model_dump())}\n\n"
                    if event.agent == "pipeline" and event.status in ("completed", "failed"):
                        break
                except asyncio.TimeoutError:
                    if instance.is_done:
                        break
                    # Send keep-alive comment
                    yield ": ping\n\n"
        finally:
            instance.remove_subscriber(queue)


# Global manager singleton
pipeline_manager = PipelineManager()
