import os
import io
import base64
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import timm
import albumentations as A
from albumentations.pytorch import ToTensorV2
from pathlib import Path
from PIL import Image

class GeM(nn.Module):
    def __init__(self, p=3.0, eps=1e-6, learnable=True):
        super().__init__()
        self.p = nn.Parameter(torch.ones(1) * p) if learnable else p
        self.eps = eps

    def forward(self, x):
        p = self.p
        x = x.clamp(min=self.eps).pow(p)
        x = F.adaptive_avg_pool2d(x, 1)
        return x.pow(1.0 / p).flatten(1)

class StrokeClsModel(nn.Module):
    def __init__(self, model_name, num_classes, drop_rate, drop_path_rate, pooling="gem", gem_p=3.0, head_hidden=512):
        super().__init__()
        self.encoder = timm.create_model(
            model_name,
            pretrained=False,
            features_only=True,
            drop_rate=drop_rate,
            drop_path_rate=drop_path_rate
        )
        feat_ch = self.encoder.feature_info.channels()[-1]
        self.pool = GeM(p=gem_p) if pooling == "gem" else nn.AdaptiveAvgPool2d(1)
        self.pooling_type = pooling
        self.head = nn.Sequential(
            nn.Linear(feat_ch, head_hidden),
            nn.BatchNorm1d(head_hidden),
            nn.ReLU(inplace=True),
            nn.Dropout(drop_rate),
            nn.Linear(head_hidden, num_classes),
        )

    def forward(self, x, return_features=False):
        feats = self.encoder(x)[-1]
        pooled = self.pool(feats) if self.pooling_type == "gem" else self.pool(feats).flatten(1)
        logits = self.head(pooled)
        if return_features:
            return logits, feats
        return logits

class StrokeClsEngine:
    def __init__(self, model_path=None, device="cpu"):
        self.device = torch.device(device)
        self.model_path = Path(model_path or r"E:\Unversity\Stroke_Aegis\DONEEEE\second_tray\stroke_ct_cls_final.pth")
        self.class_names = ("Normal", "Bleeding", "Ischemia")
        self.img_size = 384
        self.gradcam_alpha = 0.42
        self.hotspot_threshold = 0.60
        self.temperature = 0.85610437
        
        self.eval_transform = A.Compose([
            A.Resize(self.img_size, self.img_size),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ])
        
        self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"Stroke classification checkpoint not found: {self.model_path}")
            
        print(f"[StrokeClsEngine] Loading checkpoint: {self.model_path}")
        checkpoint = torch.load(self.model_path, map_location="cpu", weights_only=False)
        saved_cfg = checkpoint.get("cfg", {})
        
        model_name = saved_cfg.get("model_name", "tf_efficientnetv2_s.in1k")
        drop_rate = saved_cfg.get("drop_rate", 0.35)
        drop_path_rate = saved_cfg.get("drop_path_rate", 0.2)
        pooling = saved_cfg.get("pooling", "gem")
        gem_p = saved_cfg.get("gem_p", 3.0)
        head_hidden = saved_cfg.get("head_hidden", 512)
        
        self.class_names = tuple(checkpoint.get("class_names", self.class_names))
        self.temperature = float(checkpoint.get("temperature", self.temperature))
        
        self.model = StrokeClsModel(
            model_name=model_name,
            num_classes=len(self.class_names),
            drop_rate=drop_rate,
            drop_path_rate=drop_path_rate,
            pooling=pooling,
            gem_p=gem_p,
            head_hidden=head_hidden
        ).to(self.device)
        
        self.model.load_state_dict(checkpoint["model_state"], strict=True)
        self.model.eval()
        print(f"[StrokeClsEngine] Ready: {model_name} on {self.device}, classes={self.class_names}")

    def extract_brain_roi(self, gray, pad_frac=0.04):
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return gray, (0, 0, gray.shape[1], gray.shape[0])
            
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
        pad_x = int(w * pad_frac)
        pad_y = int(h * pad_frac)
        
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(gray.shape[1], x + w + pad_x)
        y1 = min(gray.shape[0], y + h + pad_y)
        
        roi_area_frac = ((x1 - x0) * (y1 - y0)) / (gray.shape[0] * gray.shape[1])
        if roi_area_frac < 0.4:
            return gray, (0, 0, gray.shape[1], gray.shape[0])
            
        return gray[y0:y1, x0:x1], (x0, y0, x1, y1)

    def remove_annotations(self, gray, color_img=None):
        h, w = gray.shape
        combined_mask = np.zeros((h, w), dtype=np.uint8)
        
        if color_img is not None:
            hsv = cv2.cvtColor(color_img, cv2.COLOR_BGR2HSV)
            sat_mask = (hsv[..., 1] > 30).astype(np.uint8) * 255
            kernel = np.ones((3, 3), np.uint8)
            sat_mask = cv2.morphologyEx(sat_mask, cv2.MORPH_CLOSE, kernel)
            combined_mask = cv2.bitwise_or(combined_mask, sat_mask)
            
        _, bright = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
        n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bright, connectivity=8)
        border_margin = int(0.15 * min(h, w))
        
        for i in range(1, n_labels):
            x, y, bw, bh, area = stats[i]
            if area > 400:
                continue
            near_border = (x < border_margin or y < border_margin or x + bw > w - border_margin or y + bh > h - border_margin)
            if near_border:
                combined_mask[labels == i] = 255
                
        combined_mask = cv2.dilate(combined_mask, np.ones((3, 3), np.uint8), iterations=1)
        if combined_mask.sum() == 0:
            return gray, combined_mask
            
        cleaned = cv2.inpaint(gray, combined_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
        return cleaned, combined_mask

    def apply_clahe(self, gray, clip_limit=2.0, tile_grid=8):
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid, tile_grid))
        return clahe.apply(gray)

    def normalize_percentile_clip(self, gray, low_pct=1.0, high_pct=99.0):
        g = gray.astype(np.float32)
        lo = np.percentile(g, low_pct)
        hi = np.percentile(g, high_pct)
        g = np.clip(g, lo, hi)
        return ((g - lo) / max(hi - lo, 1e-6) * 255).astype(np.uint8)

    def preprocess_image_array(self, color_bgr):
        gray = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2GRAY)
        gray_roi, roi_box = self.extract_brain_roi(gray, pad_frac=0.04)
        
        color_for_annotations = color_bgr[roi_box[1]:roi_box[3], roi_box[0]:roi_box[2]] if roi_box else color_bgr
        gray_cleaned, _ = self.remove_annotations(gray_roi, color_for_annotations)
        gray_clahe = self.apply_clahe(gray_cleaned, clip_limit=2.0, tile_grid=8)
        gray_norm = self.normalize_percentile_clip(gray_clahe, low_pct=1.0, high_pct=99.0)
        rgb_processed = cv2.cvtColor(gray_norm, cv2.COLOR_GRAY2RGB)
        return rgb_processed, roi_box

    def generate_gradcam(self, input_tensor, class_idx, output_size):
        self.model.eval()
        x = input_tensor.detach().clone().requires_grad_(True)
        self.model.zero_grad(set_to_none=True)
        
        with torch.enable_grad():
            logits, feature_map = self.model(x, return_features=True)
            feature_map.retain_grad()
            target_score = logits[0, class_idx]
            target_score.backward()
            
        gradients = feature_map.grad
        if gradients is None:
            raise RuntimeError("Grad-CAM gradients could not be computed.")
            
        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * feature_map).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=output_size, mode="bilinear", align_corners=False)
        cam = cam[0, 0].detach().cpu().numpy()
        
        cam_min, cam_max = float(cam.min()), float(cam.max())
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam, dtype=np.float32)
            
        return cam.astype(np.float32)

    def create_gradcam_visuals(self, rgb_image, cam, alpha=0.42, hotspot_threshold=0.60):
        cam_uint8 = np.uint8(np.clip(cam, 0, 1) * 255)
        heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)
        
        overlay = cv2.addWeighted(rgb_image, 1.0 - alpha, heatmap_rgb, alpha, 0)
        hotspot_mask = (cam >= hotspot_threshold).astype(np.uint8)
        hotspot_pct = float(hotspot_mask.mean() * 100.0)
        
        contours, _ = cv2.findContours(hotspot_mask * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        overlay_contour = overlay.copy()
        cv2.drawContours(overlay_contour, contours, -1, (255, 255, 255), 2)
        
        return heatmap_rgb, overlay_contour, hotspot_pct

    def project_gradcam_to_original(self, original_rgb, cam, roi_box, alpha=0.42):
        full_overlay = original_rgb.copy()
        x0, y0, x1, y1 = roi_box
        roi_w = x1 - x0
        roi_h = y1 - y0
        
        if roi_w <= 0 or roi_h <= 0:
            return full_overlay
            
        cam_roi = cv2.resize(cam, (roi_w, roi_h), interpolation=cv2.INTER_LINEAR)
        cam_uint8 = np.uint8(np.clip(cam_roi, 0, 1) * 255)
        heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)
        
        original_roi = original_rgb[y0:y1, x0:x1]
        blended_roi = cv2.addWeighted(original_roi, 1.0 - alpha, heatmap_rgb, alpha, 0)
        full_overlay[y0:y1, x0:x1] = blended_roi
        cv2.rectangle(full_overlay, (x0, y0), (x1 - 1, y1 - 1), (255, 255, 255), 2)
        return full_overlay

    def _to_base64_jpeg(self, img_rgb):
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        _, buffer = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

    def diagnose(self, image_input):
        if isinstance(image_input, (str, Path)):
            color_bgr = cv2.imread(str(image_input), cv2.IMREAD_COLOR)
        elif isinstance(image_input, (bytes, bytearray)):
            nparr = np.frombuffer(image_input, np.uint8)
            color_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif isinstance(image_input, Image.Image):
            color_bgr = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
        else:
            raise ValueError("Unsupported image input type")
            
        if color_bgr is None:
            raise ValueError("Could not decode image input.")
            
        original_rgb = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2RGB)
        rgb_processed, roi_box = self.preprocess_image_array(color_bgr)
        
        transformed = self.eval_transform(image=rgb_processed)
        input_tensor = transformed["image"].unsqueeze(0).to(self.device)
        
        with torch.inference_mode():
            logits = self.model(input_tensor)
            calibrated_logits = logits / max(float(self.temperature), 1e-6)
            probabilities = torch.softmax(calibrated_logits, dim=1)[0]
            
        probs = probabilities.cpu().numpy()
        predicted_idx = int(np.argmax(probs))
        predicted_class = self.class_names[predicted_idx]
        confidence = float(probs[predicted_idx])
        
        class_probs = {cls_name: round(float(p) * 100, 2) for cls_name, p in zip(self.class_names, probs)}
        
        use_gradcam = predicted_class in ("Bleeding", "Ischemia")
        gradcam_res = {}
        
        if use_gradcam:
            cam = self.generate_gradcam(input_tensor, predicted_idx, (rgb_processed.shape[0], rgb_processed.shape[1]))
            heatmap_rgb, overlay_contour, hotspot_pct = self.create_gradcam_visuals(rgb_processed, cam, self.gradcam_alpha, self.hotspot_threshold)
            full_overlay = self.project_gradcam_to_original(original_rgb, cam, roi_box, self.gradcam_alpha)
            
            cam_sum = float(cam.sum())
            focus_x_pct, focus_y_pct = 50.0, 50.0
            if cam_sum > 1e-8:
                yy, xx = np.indices(cam.shape)
                focus_x = float((cam * xx).sum() / cam_sum)
                focus_y = float((cam * yy).sum() / cam_sum)
                focus_x_pct = round(focus_x / max(cam.shape[1] - 1, 1) * 100, 1)
                focus_y_pct = round(focus_y / max(cam.shape[0] - 1, 1) * 100, 1)
                
            hemisphere = "Left Hemisphere" if focus_x_pct < 50 else "Right Hemisphere"
            quadrant = ("Anterior " if focus_y_pct < 50 else "Posterior ") + hemisphere
            
            gradcam_res = {
                "use_gradcam": True,
                "hotspot_coverage_pct": round(hotspot_pct, 2),
                "focus_centroid": {"x_pct": focus_x_pct, "y_pct": focus_y_pct},
                "anatomical_quadrant": quadrant,
                "heatmap_image": self._to_base64_jpeg(heatmap_rgb),
                "overlay_contour_image": self._to_base64_jpeg(overlay_contour),
                "full_projection_image": self._to_base64_jpeg(full_overlay),
            }
        else:
            gradcam_res = {
                "use_gradcam": False,
                "reassurance": "Normal brain parenchyma identified. Bilateral cerebral hemispheres exhibit symmetric attenuation without acute intracranial hemorrhage or territorial ischemic demarcation.",
            }
            
        status_labels = {
            "Normal": "NON-PATHOLOGICAL (NO ACUTE STROKE PATTERN)",
            "Bleeding": "ACUTE HEMORRHAGIC STROKE (INTRACRANIAL BLEEDING)",
            "Ischemia": "ACUTE ISCHEMIC STROKE (INFARCTION / HYPODENSITY)",
        }
        
        return {
            "prediction": predicted_class,
            "confidence_pct": round(confidence * 100, 2),
            "status_banner": status_labels.get(predicted_class, predicted_class),
            "class_probabilities": class_probs,
            "original_image": self._to_base64_jpeg(original_rgb),
            "roi_preprocessed_image": self._to_base64_jpeg(rgb_processed),
            "roi_box": list(roi_box),
            "gradcam": gradcam_res
        }
