"""ResNet50 architecture for YuzuMarker font detection.

This re-creates the classification+regression head used by YuzuMarker.FontDetection
so that SafeTensors weights can be loaded directly.
"""
from __future__ import annotations

try:
    import torch  # type: ignore
    import torch.nn as nn  # type: ignore
    from torchvision.models import resnet50  # type: ignore

    def build_resnet50_font_model(num_outputs: int = 6162) -> nn.Module:
        """Build a ResNet50 backbone with a single FC head producing *num_outputs* values."""
        backbone = resnet50(weights=None)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Linear(in_features, num_outputs)
        return backbone

except ImportError:
    def build_resnet50_font_model(num_outputs: int = 6162):  # type: ignore[misc]
        raise RuntimeError(
            "torch + torchvision required for SafeTensors-based YuzuMarker font detection. "
            "Install with: pip install torch torchvision"
        )
