"""Hoppy sans fond : public/hoppy.png (fond blanc) -> public/hoppy-cut.png (PNG transparent, sans l'ombre au sol).
python3 scripts/hoppy_cut.py"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.asarray(Image.open(os.path.join(ROOT, 'public', 'hoppy.png')).convert('RGB')).astype(float)
mn, mx = im.min(axis=2), im.max(axis=2)
d, sat = 255 - mn, mx - mn
a = np.clip((d - 5) / 16, 0, 1)
a[sat > 22] = 1                                   # couleurs (fourrure, sac) : opaques
lab, n = ndimage.label(a < 0.5)                   # le fond est relié aux bords de l'image
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
alpha = np.where(np.isin(lab, list(edge)), a, 1.0)
alpha = ndimage.gaussian_filter(alpha, 0.6)
ys = np.arange(im.shape[0])[:, None]
alpha = np.where((ys > 1375) & (sat < 26), 0, alpha)   # ombre au sol retirée
Image.fromarray(np.dstack([im, alpha * 255]).astype(np.uint8), 'RGBA').save(os.path.join(ROOT, 'public', 'hoppy-cut.png'))
print('ok hoppy-cut.png')
