"""
StrokeAegis AI — CrewAI RAG Tool
Provides a formal CrewAI BaseTool interface to the StrokeAegis Medical RAG service.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field
from crewai.tools import BaseTool

from .rag_client import query_medical_rag


class RAGQueryInput(BaseModel):
    """Input schema for guideline retrieval queries."""
    query: str = Field(
        ...,
        description="Clinical query or question for medical guideline evidence retrieval."
    )
    agent: Optional[str] = Field(
        default=None,
        description="Target clinical agent context: 'prevention' or 'emergency'."
    )
    condition: Optional[str] = Field(
        default=None,
        description="Medical condition context: 'stroke_prevention', 'ischemic_stroke', or 'hemorrhagic_stroke'."
    )
    topic: Optional[str] = Field(
        default=None,
        description="Clinical topic filter (e.g. 'blood_pressure', 'thrombolysis', 'thrombectomy', 'lifestyle', 'lipids')."
    )
    top_k: int = Field(
        default=4,
        description="Number of authoritative evidence chunks to retrieve (1-10)."
    )


class StrokeAegisRAGTool(BaseTool):
    """
    CrewAI Tool providing access to the 501 indexed clinical guideline chunks
    from AHA/ASA, ESO, NICE, and WHO.
    """
    name: str = "strokeaegis_rag_tool"
    description: str = (
        "Search and retrieve authoritative stroke clinical practice guidelines from AHA/ASA, "
        "ESO, NICE, and WHO. Always use this tool to ground clinical recommendations in "
        "verifiable evidence. Returns verbatim guideline recommendations with source citations."
    )
    args_schema: Type[BaseModel] = RAGQueryInput

    def _run(
        self,
        query: str,
        agent: Optional[str] = None,
        condition: Optional[str] = None,
        topic: Optional[str] = None,
        top_k: int = 4
    ) -> str:
        results = query_medical_rag(
            query=query,
            agent=agent,
            condition=condition,
            topic=topic,
            top_k=top_k
        )

        if not results:
            return f"No medical guideline evidence found matching query: '{query}'."

        formatted_chunks = []
        for idx, item in enumerate(results, 1):
            chunk_str = (
                f"--- EVIDENCE ITEM {idx} ---\n"
                f"Citation: {item['citation']}\n"
                f"Source: {item['source']} | Guideline: {item['guideline']} | Year: {item.get('year', 'N/A')} | Page: {item.get('page', 'N/A')}\n"
                f"Section: {item['section']}\n"
                f"Recommendation Content:\n{item['text']}\n"
            )
            formatted_chunks.append(chunk_str)

        return "\n".join(formatted_chunks)
