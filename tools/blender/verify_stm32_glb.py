"""Validate the exported GLB container, mesh accessors, indices, normals and bounds."""
from pathlib import Path
import json
import math
import struct
ROOT = Path(__file__).resolve().parents[2]
folder = ROOT / "models" / "stm32f103c8t6"
data = (folder / "stm32f103c8t6.glb").read_bytes()
magic, version, length = struct.unpack_from("<4sII", data)
assert magic == b"glTF" and version == 2 and length == len(data)
offset = 12
chunks = {}
while offset < len(data):
    size, kind = struct.unpack_from("<I4s", data, offset)
    chunks[kind] = data[offset + 8:offset + 8 + size]
    offset += 8 + size
doc = json.loads(chunks[b"JSON"])
binary = chunks[b"BIN\x00"]
formats = {5126:("f",4),5125:("I",4),5123:("H",2),5121:("B",1)}
widths = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}
def accessor(i):
    a = doc["accessors"][i]
    view = doc["bufferViews"][a["bufferView"]]
    fmt, size = formats[a["componentType"]]
    width = widths[a["type"]]
    start = view.get("byteOffset",0) + a.get("byteOffset",0)
    stride = view.get("byteStride",size*width)
    assert start + (a["count"]-1)*stride + size*width <= len(binary)
    return [struct.unpack_from("<"+fmt*width,binary,start+j*stride) for j in range(a["count"])]
triangles = 0
minimum = [math.inf]*3
maximum = [-math.inf]*3
for mesh in doc["meshes"]:
    for primitive in mesh["primitives"]:
        assert primitive.get("mode",4) == 4
        points = accessor(primitive["attributes"]["POSITION"])
        assert all(math.isfinite(v) for p in points for v in p)
        for p in points:
            for k in range(3):
                minimum[k] = min(minimum[k],p[k])
                maximum[k] = max(maximum[k],p[k])
        indices = [x[0] for x in accessor(primitive["indices"])]
        assert len(indices)%3 == 0
        assert min(indices)>=0 and max(indices)<len(points)
        triangles += len(indices)//3
        normals = accessor(primitive["attributes"]["NORMAL"])
        assert all(abs(sum(x*x for x in n)-1) < 0.002 for n in normals)
assert len(doc["meshes"]) == 14
assert triangles == 71860
assert not any(n.get("name") in ("Cube","Camera","Light") for n in doc["nodes"])
size_mm = [round((hi-lo)*1000,3) for lo,hi in zip(minimum,maximum)]
assert 58 < size_mm[0] < 60 and 10 < size_mm[1] < 11 and 22 < size_mm[2] < 24
result = {
    "valid": True, "format": "glTF 2.0 GLB", "triangles":triangles,
    "meshes":len(doc["meshes"]), "materials":len(doc["materials"]),
    "dimensions_mm_y_up":size_mm,
    "files":{p.name:p.stat().st_size for p in folder.iterdir() if p.suffix in (".blend",".glb",".png")},
    "notes":["PCB itself is 52 x 23 x 1.6 mm; connectors extend beyond the board.",
             "GLB coordinates are metres, Y-up.","All accessor values and normals checked; all indices in range."]
}
(folder/"export-validation.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result,indent=2))
