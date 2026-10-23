"""Recover selectable components from the material-batched GLB, preserving every triangle.
Connected geometry islands are assigned using the known board layout in millimetres.
No mesh simplification or remodelling is performed.
"""
from pathlib import Path
import json, struct
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[2]
raw=(ROOT/"models/stm32f103c8t6/stm32f103c8t6.glb").read_bytes()
jsize=struct.unpack_from("<I",raw,12)[0]
src=json.loads(raw[20:20+jsize])
start=20+jsize
bsize=struct.unpack_from("<I",raw,start)[0]
binary=raw[start+8:start+8+bsize]
def read(i):
    a=src["accessors"][i];v=src["bufferViews"][a["bufferView"]]
    fmt,size={5126:("f",4),5125:("I",4),5123:("H",2),5121:("B",1)}[a["componentType"]]
    width={"SCALAR":1,"VEC3":3,"VEC2":2,"VEC4":4}[a["type"]]
    off=v.get("byteOffset",0)+a.get("byteOffset",0)
    stride=v.get("byteStride",width*size)
    return [struct.unpack_from("<"+fmt*width,binary,off+j*stride) for j in range(a["count"])]
passives=[("c1",-1,-5.7),("c2",-1,6.25),("c3",5.8,3.2),("c4",5.8,-3.2),
 ("c5",-11.7,-2.4),("c6",-7.1,-2.4),("c7",-19,-4.8),("c8",-15.5,-4.8),
 ("c9",-10.6,-7.4),("c10",-6.4,-7.4),("r1",7.5,5.8),("r2",7.5,-5.8),
 ("r3",18.8,-5.4),("r4",22,-5.4),("r5",-18.8,-6.8),("r6",-15.4,-6.8),("r7",1.9,-6.3)]
def classify(material,lo,hi):
    x,y,z=((lo[k]+hi[k])/2 for k in range(3))
    # Convert Y-up GLB coordinates back to the construction coordinates in mm.
    x,y,z=x*1000,-z*1000,y*1000
    height=(hi[1]-lo[1])*1000
    if material == "M_Silkscreen" and height > 0.1:
        if -20<x<-17.6 and -3.3<y<-1.9: return "led-power"
        if -16.6<x<-14.2 and -3.3<y<-1.9: return "led-user"
    if material in ("M_FR4_Edge","M_Soldermask_Blue","M_Masked_Copper","M_Silkscreen"):
        return "pcb"
    if abs(y)>8.5 and z>4.9 and material in ("M_Header_Plastic","M_Gold_Plated"):
        return "header-bottom" if y<0 else "header-top"
    if material=="M_Boot_Jumper": return "boot0" if y<0 else "boot1"
    if material not in ("M_Laser_Marking",):
        for name,px,py in passives:
            if abs(x-px)<1.0 and abs(y-py)<1.0 and z>4.7: return name
    if -20<x<-17.6 and -3.3<y<-1.9 and z>4.7: return "led-power"
    if -16.6<x<-14.2 and -3.3<y<-1.9 and z>4.7: return "led-user"
    if x>23.5 and z>5 and material in ("M_Header_Plastic","M_Gold_Plated"): return "swd"
    if -5.7<x<3.7 and abs(y)<4.7 and z>4.68: return "mcu"
    if x<-20 and abs(y)<4.8 and z>4.65: return "usb"
    if -20.2<x<-12.6 and -0.7<y<6.0 and z>4.7: return "regulator"
    if -12.1<x<-6.5 and -1.1<y<2.7 and z>4.68: return "crystal-hse"
    if -10.7<x<-6.3 and -6.8<y<-4.6 and z>4.68: return "crystal-lse"
    if 7.6<x<15.5 and 0.7<abs(y)<3.5 and z>4.7: return "boot0" if y<0 else "boot1"
    if 16.4<x<23.5 and -2.9<y<4 and z>4.7: return "reset"
    return "pcb"
parts=defaultdict(lambda:defaultdict(list))
input_tris=0
for mesh in src["meshes"]:
    for prim in mesh["primitives"]:
        positions=read(prim["attributes"]["POSITION"])
        normals=read(prim["attributes"]["NORMAL"])
        indices=[x[0] for x in read(prim["indices"])]
        parent=list(range(len(positions)))
        def find(i):
            while parent[i]!=i:
                parent[i]=parent[parent[i]];i=parent[i]
            return i
        def union(a,b):
            a,b=find(a),find(b)
            if a!=b: parent[a]=b
        by_position={}
        for i,p in enumerate(positions):
            key=tuple(round(v,8) for v in p)
            if key in by_position: union(i,by_position[key])
            else: by_position[key]=i
        for j in range(0,len(indices),3):
            a,b,c=indices[j:j+3];union(a,b);union(a,c)
        islands=defaultdict(list)
        for j in range(0,len(indices),3):
            tri=indices[j:j+3]
            islands[find(tri[0])].append(tri)
        material=prim["material"]
        for triangles in islands.values():
            ids={i for tri in triangles for i in tri}
            lo=[min(positions[i][k] for i in ids) for k in range(3)]
            hi=[max(positions[i][k] for i in ids) for k in range(3)]
            part=classify(src["materials"][material]["name"],lo,hi)
            for tri in triangles:
                parts[part][material].append([(positions[i],normals[i]) for i in tri])
                input_tris+=1
out={"asset":{"version":"2.0","generator":"Board Atlas semantic grouping"},
     "scene":0,"scenes":[{"nodes":[]}],"nodes":[],"meshes":[],
     "materials":src["materials"],"bufferViews":[],"accessors":[],"buffers":[]}
for k in ("extensionsUsed","extensionsRequired","extensions"):
    if k in src: out[k]=src[k]
blob=bytearray()
def add(values,ctype,typ):
    while len(blob)%4: blob.append(0)
    fmt,size={5126:("f",4),5125:("I",4)}[ctype]
    width=3 if typ=="VEC3" else 1
    offset=len(blob)
    for v in values: blob.extend(struct.pack("<"+fmt*width,*v))
    view=len(out["bufferViews"])
    out["bufferViews"].append({"buffer":0,"byteOffset":offset,"byteLength":len(blob)-offset})
    accessor={"bufferView":view,"componentType":ctype,"count":len(values),"type":typ}
    if typ=="VEC3":
        accessor["min"]=[min(v[k] for v in values) for k in range(3)]
        accessor["max"]=[max(v[k] for v in values) for k in range(3)]
    out["accessors"].append(accessor)
    return len(out["accessors"])-1
manifest=[]
for name,batches in sorted(parts.items()):
    group_index=len(out["nodes"])
    out["nodes"].append({"name":"part_"+name,"children":[],"extras":{"component_id":name}})
    out["scenes"][0]["nodes"].append(group_index)
    count=0
    for material,triangles in sorted(batches.items()):
        cache={};positions=[];normals=[];indices=[]
        for tri in triangles:
            for p,n in tri:
                key=(p,n)
                if key not in cache:
                    cache[key]=len(positions);positions.append(p);normals.append(n)
                indices.append((cache[key],))
        pa=add(positions,5126,"VEC3");na=add(normals,5126,"VEC3");ia=add(indices,5125,"SCALAR")
        mesh_index=len(out["meshes"])
        out["meshes"].append({"name":name+"_"+str(material),"primitives":[{"attributes":{"POSITION":pa,"NORMAL":na},"indices":ia,"material":material}]})
        out["nodes"][group_index]["children"].append(len(out["nodes"]))
        out["nodes"].append({"name":"mesh_"+name+"_"+str(material),"mesh":mesh_index})
        count+=len(triangles)
    manifest.append({"id":name,"meshes":len(batches),"triangles":count})
out["buffers"]=[{"byteLength":len(blob)}]
text=json.dumps(out,separators=(",",":")).encode()
while len(text)%4: text+=b" "
while len(blob)%4: blob.append(0)
payload=struct.pack("<4sII",b"glTF",2,12+8+len(text)+8+len(blob))+struct.pack("<I4s",len(text),b"JSON")+text+struct.pack("<I4s",len(blob),b"BIN\0")+blob
dest=ROOT/"public"/"models";dest.mkdir(parents=True,exist_ok=True)
(dest/"stm32-interactive.glb").write_bytes(payload)
report={"components":len(parts),"meshes":len(out["meshes"]),"triangles":input_tris,"bytes":len(payload),"parts":manifest}
assert input_tris==71860
assert len(parts)==31,sorted(parts)
(dest/"model-manifest.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))
