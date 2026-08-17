#!/usr/bin/env python3
"""generate_assets.py — build the RealWorld 2-piece puzzle logo from the traced
pieces in logo_parts.json. The defaults reproduce the exact published logo.

Outputs (next to this script):
  realworld-logo-2piece.svg          with the green check
  realworld-logo-2piece-nocheck.svg  check removed; the bite it left in the
                                      top-right corner is filled by mirroring the
                                      clean top-LEFT corner across the piece.

Pieces are never reshaped: the middle piece is dropped, the top piece is slid
down by DY to plug into the bottom, and a DEAD vertical strip (COLLAPSE) is
removed from the flat part of the seam.
"""
import json, os, re

HERE  = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(HERE, "logo_parts.json")
MEDIA = os.path.normpath(os.path.join(HERE, "..", "media"))   # outputs live in assets/media/

# ---- defaults that reproduce the exact logo --------------------------------
DY       = 72                      # how far the top piece slides down to plug in
COLLAPSE = (92, 16)                # (X0, W): cut a W-wide dead strip starting at X0
COLORS   = {"top": "#55aaff", "bottom": "#3388ff", "check": "#44bb55"}
PAD      = 6

NUM = re.compile(r"-?\d+(?:\.\d+)?")

# potrace `d` uses only M/L/C/Z, so the number stream alternates x,y,x,y...
def remap(d, fx=lambda x: x, fy=lambda y: y):
    out = [f"{(fx if i % 2 == 0 else fy)(float(t)):.3f}" for i, t in enumerate(NUM.findall(d))]
    it = iter(out)
    return NUM.sub(lambda m: next(it), d)

def xs(d): return [float(v) for v in NUM.findall(d)][0::2]
def ys(d): return [float(v) for v in NUM.findall(d)][1::2]

def load_pieces():
    P = json.load(open(PARTS))["paths"]
    x0, w = COLLAPSE
    fx = lambda x: (x if x <= x0 else (x0 if x < x0 + w else x - w))   # collapse the strip
    P = {k: remap(v, fx=fx) for k, v in P.items()}
    P["top"]   = remap(P["top"],   fy=lambda y: y + DY)               # slide top + check down
    P["check"] = remap(P["check"], fy=lambda y: y + DY)
    return P

def header(paths):
    minx = min(min(xs(p)) for p in paths); maxx = max(max(xs(p)) for p in paths)
    miny = min(min(ys(p)) for p in paths); maxy = max(max(ys(p)) for p in paths)
    cw, ch = (maxx - minx) + 2 * PAD, (maxy - miny) + 2 * PAD
    side = max(cw, ch)
    vbx = minx - PAD - (side - cw) / 2
    vby = miny - PAD - (side - ch) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{vbx:.1f} {vby:.1f} {side:.1f} {side:.1f}" '
            f'width="{side:.0f}" height="{side:.0f}">')

def zoom_header(P, inset):
    """Crop INSIDE the rounded outer border so the blue runs edge-to-edge; the
    only transparent part left is the interlocking seam between the pieces."""
    pcs = [P["bottom"], P["top"]]
    minx = min(min(xs(p)) for p in pcs); maxx = max(max(xs(p)) for p in pcs)
    miny = min(min(ys(p)) for p in pcs); maxy = max(max(ys(p)) for p in pcs)
    x0, y0 = minx + inset, miny + inset
    w, h = (maxx - inset) - x0, (maxy - inset) - y0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}">')

def build(check=True, inset=None):
    P = load_pieces()
    # include the check in the bbox when present, so the framing matches the
    # original (otherwise the check spills outside the viewBox).
    parts = [P["bottom"], P["top"]] + ([P["check"]] if check else [])
    body  = [f'<path d="{P["bottom"]}" fill="{COLORS["bottom"]}"/>',
             f'<path d="{P["top"]}" fill="{COLORS["top"]}"/>']
    if check:
        body.append(f'<path d="{P["check"]}" fill="{COLORS["check"]}"/>')
    else:
        # mirror the whole top piece across its own centre, then clip to the
        # top-right corner so we only borrow the (now clean) corner, not the seam.
        txs, tys = xs(P["top"]), ys(P["top"])
        xc, ty0 = (min(txs) + max(txs)) / 2, min(tys)
        mirror = remap(P["top"], fx=lambda x: 2 * xc - x)
        # end the clip at the swoosh tip (where the mirror's straight right edge
        # and the original edge coincide at max-x) so there's no step/ledge.
        tip_y = max(y for x, y in zip(txs, tys) if x > max(txs) - 0.6)
        rx, ry = xc - 2, ty0 - 4
        rw, rh = (max(txs) + 4) - rx, tip_y - ry
        # the mirror leaves one tiny gap where the mirrored up-tab socket lands on
        # the swoosh; bridge it with a small solid patch (all edges sit in blue).
        bridge = "M 123 138 L 142 138 L 142 154 L 123 154 Z"
        body = ([f'<clipPath id="tr"><rect x="{rx:.1f}" y="{ry:.1f}" '
                 f'width="{rw:.1f}" height="{rh:.1f}"/></clipPath>']
                + body
                + [f'<path d="{mirror}" fill="{COLORS["top"]}" clip-path="url(#tr)"/>',
                   f'<path d="{bridge}" fill="{COLORS["top"]}"/>'])
    hdr = zoom_header(P, inset) if inset is not None else header(parts)
    return hdr + "\n  " + "\n  ".join(body) + "\n</svg>\n"

def pts(d):
    n = [float(v) for v in NUM.findall(d)]
    return list(zip(n[0::2], n[1::2]))

def flatten(d, n=12):
    """Dense points ON the path (sampling each cubic), so we can read the actual
    edge y at any x - control-point vertices alone miss the curve."""
    out, cur, start = [], (0, 0), (0, 0)
    for m in re.finditer(r'([MLCZ])([^MLCZ]*)', d):
        cmd = m.group(1); v = [float(x) for x in NUM.findall(m.group(2))]
        if cmd == 'M':
            cur = (v[0], v[1]); start = cur; out.append(cur)
            for j in range(2, len(v), 2): cur = (v[j], v[j+1]); out.append(cur)
        elif cmd == 'L':
            for j in range(0, len(v), 2): cur = (v[j], v[j+1]); out.append(cur)
        elif cmd == 'C':
            for j in range(0, len(v), 6):
                c1, c2, e = (v[j], v[j+1]), (v[j+2], v[j+3]), (v[j+4], v[j+5])
                for k in range(1, n+1):
                    t = k/n; u = 1-t
                    out.append((u*u*u*cur[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*e[0],
                                u*u*u*cur[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*e[1]))
                cur = e
        elif cmd == 'Z':
            cur = start
    return out

def build_seam():
    """Same canvas/proportions as the no-check logo, but every OUTER edge of each
    piece is pushed past the canvas so the colour bleeds to all four edges; only
    the interlocking seam stays transparent. Nothing about the seam is changed -
    we just add big rectangles that extend each piece away from the seam:
      top piece    -> top / left / right out
      bottom piece -> bottom / left / right out
    The left/right rectangles stop at the seam's exit y on each side, so the gap
    is carried straight out to the canvas edges."""
    P = load_pieces()
    tp, bp = flatten(P["top"]), flatten(P["bottom"])
    minx_t = min(p[0] for p in tp); maxx_t = max(p[0] for p in tp); miny_t = min(p[1] for p in tp)
    minx_b = min(p[0] for p in bp); maxx_b = max(p[0] for p in bp); maxy_b = max(p[1] for p in bp)
    # where the seam exits each side (top piece's bottom edge / bottom piece's top edge)
    SL  = max(p[1] for p in tp if p[0] <= minx_t + 2)
    SR  = max(p[1] for p in tp if p[0] >= maxx_t - 2)
    SLb = min(p[1] for p in bp if p[0] <= minx_b + 2)
    SRb = min(p[1] for p in bp if p[0] >= maxx_b - 2)

    # viewBox == the no-check logo's (squared bbox of bottom+top + PAD) -> proportions kept
    minx = min(minx_t, minx_b); maxx = max(maxx_t, maxx_b)
    miny = min(miny_t, min(p[1] for p in bp)); maxy = max(maxy_b, max(p[1] for p in tp))
    cw, ch = (maxx - minx) + 2 * PAD, (maxy - miny) + 2 * PAD
    side = max(cw, ch)
    vbx = minx - PAD - (side - cw) / 2
    vby = miny - PAD - (side - ch) / 2
    O = side                                          # overflow distance
    L, Rr, T, B = vbx - O, vbx + side + O, vby - O, vby + side + O

    # Clean channel level sampled INWARD (past the rounded exit curl, before the
    # first tab) so the side exits become a flat horizontal band, not the trace's
    # little curl. XFL/XFR split "trim to channel level" margins from the untouched
    # central tabs.
    XFL, XFR = minx_t + 14, maxx_t - 14
    near = lambda pp, xv: [p[1] for p in pp if abs(p[0] - xv) <= 6]
    SLc, SRc = max(near(tp, XFL)), max(near(tp, XFR))     # top piece bottom edge -> channel top
    SLbc, SRbc = min(near(bp, XFL)), min(near(bp, XFR))   # bottom piece top edge -> channel bottom

    xc = (minx_t + maxx_t) / 2
    mirror = remap(P["top"], fx=lambda x: 2 * xc - x)
    tip_y = max(p[1] for p in tp if p[0] > maxx_t - 0.6)
    rx, ry, rw, rh = xc - 2, miny_t - 4, (maxx_t + 4) - (xc - 2), tip_y - (miny_t - 4)
    bridge = "M 123 138 L 142 138 L 142 154 L 123 154 Z"
    dark, light = COLORS["bottom"], COLORS["top"]

    def frect(x0, y0, x1, y1, fill):
        return f'<path d="M {x0:.1f} {y0:.1f} H {x1:.1f} V {y1:.1f} H {x0:.1f} Z" fill="{fill}"/>'

    # ONE polygon per clip (no internal edge -> no anti-alias seam). Central column
    # is full height (keeps the tabs); side margins are trimmed to the channel level.
    lpoly = f'M {L:.1f} {T:.1f} H {Rr:.1f} V {SRc:.1f} H {XFR:.1f} V {B:.1f} H {XFL:.1f} V {SLc:.1f} H {L:.1f} Z'
    dpoly = f'M {L:.1f} {B:.1f} H {Rr:.1f} V {SRbc:.1f} H {XFR:.1f} V {T:.1f} H {XFL:.1f} V {SLbc:.1f} H {L:.1f} Z'
    light_clip = f'<clipPath id="lc"><path d="{lpoly}"/></clipPath>'
    dark_clip  = f'<clipPath id="dc"><path d="{dpoly}"/></clipPath>'
    tr_clip    = f'<clipPath id="tr"><rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}"/></clipPath>'

    dark_group = (f'<g clip-path="url(#dc)">'
                  f'<path d="{P["bottom"]}" fill="{dark}"/>'
                  f'{frect(L, maxy_b-18, Rr, B, dark)}'   # below
                  f'{frect(L, T, XFL, B, dark)}'          # left column (clip keeps y>=SLbc)
                  f'{frect(XFR, T, Rr, B, dark)}'         # right column (clip keeps y>=SRbc)
                  f'</g>')
    light_group = (f'<g clip-path="url(#lc)">'
                   f'<path d="{P["top"]}" fill="{light}"/>'
                   f'<path d="{mirror}" fill="{light}" clip-path="url(#tr)"/>'
                   f'<path d="{bridge}" fill="{light}"/>'
                   f'{frect(L, T, Rr, miny_t+18, light)}'  # above
                   f'{frect(L, T, XFL, B, light)}'         # left column (clip keeps y<=SLc)
                   f'{frect(XFR, T, Rr, B, light)}'        # right column (clip keeps y<=SRc)
                   f'</g>')

    hdr = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vbx:.1f} {vby:.1f} {side:.1f} {side:.1f}" '
           f'width="{side:.0f}" height="{side:.0f}">')
    return (hdr + "\n  <defs>" + tr_clip + light_clip + dark_clip + "</defs>\n  "
            + dark_group + "\n  " + light_group + "\n</svg>\n")

def _svg_inner(svg):
    """(viewBox, inner-markup) of an <svg> string."""
    vb = re.search(r'viewBox="([^"]*)"', svg).group(1)
    return vb, svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]

def build_dual_mode():
    """The banner: the primary (no-check) logo + the vectorised title text, laid
    out on the original 1669x284 canvas. realworld-title-text.svg is a static
    traced asset (it lives in assets/media/ and is read here)."""
    lvb, lbody = _svg_inner(build(check=False))
    tvb, tbody = _svg_inner(open(os.path.join(MEDIA, "realworld-title-text.svg")).read())
    # crop the canvas to the content (logo+text span y62..221) + a ~16px even
    # margin, so the banner has no dead vertical space. Logo/text y stay as set.
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 46 1669 191" width="1669" height="191">\n'
            f'  <svg x="42" y="37" width="210" height="210" viewBox="{lvb}">{lbody}</svg>\n'
            f'  <svg x="282" y="95.5" width="1352" height="114" viewBox="{tvb}">{tbody}</svg>\n'
            f'</svg>\n')

def build_all():
    """Write every published logo to assets/media/. Returns the filenames written."""
    outputs = {
        "realworld-logo.svg":               build(check=False),   # primary, no checkmark
        "realworld-logo-checkmark.svg":      build(check=True),    # with the green check
        "realworld-logo-complete-fill.svg":  build_seam(),         # full-bleed, transparent seam
        "realworld-dual-mode.svg":           build_dual_mode(),    # logo + title-text banner
    }
    for name, svg in outputs.items():
        open(os.path.join(MEDIA, name), "w").write(svg)
    return list(outputs)

if __name__ == "__main__":
    print("wrote " + ", ".join(build_all()))
