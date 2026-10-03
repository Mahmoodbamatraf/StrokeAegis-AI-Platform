import io
import json
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import torch
import torch.nn as nn
from torchvision.models import convnext_tiny

class GateEngine:
    def __init__(self, model_path=None, metadata_path=None, device="cpu"):
        self.device = torch.device(device)
        self.model_path = Path(model_path or r"E:\Unversity\Stroke_Aegis\DONEEEE\the_door_model\convnext_brain_ct_gate.pt")
        self.metadata_path = Path(metadata_path or r"E:\Unversity\Stroke_Aegis\DONEEEE\the_door_model\model_metadata.json")
        
        self.labels = ["not_brain_ct", "brain_ct"]
        self.image_size = 224
        self.acceptance_threshold = 0.2019
        self.review_lower_bound = 0.1413
        
        if self.metadata_path.exists():
            try:
                meta = json.loads(self.metadata_path.read_text(encoding="utf-8"))
                self.acceptance_threshold = float(meta.get("acceptance_threshold", self.acceptance_threshold))
                self.review_lower_bound = float(meta.get("review_lower_bound", self.review_lower_bound))
                self.labels = meta.get("labels", self.labels)
            except Exception as e:
                print(f"[GateEngine] Warning loading metadata: {e}")
                
        self.imagenet_mean = np.asarray([0.485, 0.456, 0.406], dtype=np.float32)
        self.imagenet_std = np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
        
        self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"Gate model checkpoint not found: {self.model_path}")
            
        print(f"[GateEngine] Loading checkpoint: {self.model_path}")
        try:
            checkpoint = torch.load(self.model_path, map_location="cpu", weights_only=False)
        except TypeError:
            checkpoint = torch.load(self.model_path, map_location="cpu")
            
        self.model = convnext_tiny(weights=None)
        in_features = self.model.classifier[2].in_features
        self.model.classifier[2] = nn.Sequential(
            nn.Dropout(p=0.30),
            nn.Linear(in_features, 2),
        )
        
        state_dict = checkpoint["state_dict"] if "state_dict" in checkpoint else checkpoint
        self.model.load_state_dict(state_dict, strict=True)
        self.model = self.model.to(self.device).eval()
        print("[GateEngine] ConvNeXt-Tiny Brain CT Gate ready.")

    def preprocess(self, image: Image.Image):
        img_proc = (
            ImageOps.exif_transpose(image)
            .convert("L")
            .resize((self.image_size, self.image_size))
        )
        arr = np.repeat(np.asarray(img_proc, dtype=np.float32)[..., None], 3, axis=2)
        arr = (arr / 255.0 - self.imagenet_mean) / self.imagenet_std
        tensor_np = np.transpose(arr, (2, 0, 1))[None].astype(np.float32)
        tensor_torch = torch.from_numpy(tensor_np).to(self.device)
        return tensor_torch, img_proc

    @torch.inference_mode()
    def verify(self, image_input):
        if isinstance(image_input, Image.Image):
            img = image_input.copy()
        elif isinstance(image_input, (bytes, bytearray)):
            img = Image.open(io.BytesIO(image_input))
        else:
            img = Image.open(str(image_input))

        tensor_torch, _ = self.preprocess(img)
        logits = self.model(tensor_torch)[0]
        probs = torch.softmax(logits, dim=0)

        p_not_brain = float(probs[0].item())
        p_brain = float(probs[1].item())

        predicted_index = int(torch.argmax(probs).item())
        predicted_class = self.labels[predicted_index]
        confidence = float(probs[predicted_index].item())

        if predicted_class == "brain_ct":
            status = "accept_brain_ct"
            accepted = True
            message = (
                f"Valid Brain CT Scan Confirmed ({p_brain * 100:.1f}% confidence). "
                "The image has passed the StrokeAegis safety gate and can proceed to diagnostic analysis."
            )
        else:
            status = "reject_not_brain_ct"
            accepted = False
            message = (
                f"Non-Brain CT Scan Detected ({p_not_brain * 100:.1f}% non-brain-CT confidence). "
                "Diagnostic inference blocked to prevent clinical misinterpretation. Please upload an authentic Brain CT scan."
            )

        return {
            "accepted": accepted,
            "status": status,
            "predicted_class": predicted_class,
            "confidence": confidence,
            "confidence_pct": round(confidence * 100, 2),
            "p_not_brain_ct": p_not_brain,
            "p_brain_ct": p_brain,
            "p_not_brain_pct": round(p_not_brain * 100, 2),
            "p_brain_pct": round(p_brain * 100, 2),
            "message": message,
            "acceptance_threshold": self.acceptance_threshold,
        }
