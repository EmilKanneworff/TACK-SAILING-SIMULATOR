"""Pack the CC0 MakeHuman base mesh as a small embedded GLB.

Run Blender in background with --python scripts/prepare-crew.py -- base.obj output.js.
Coordinates in the source OBJ are decimetres. Only the head and a curled hand
are exported. Clothing and the sailing rig are fitted in the game.
"""

import base64
import json
import struct
import sys
from pathlib import Path

import bpy
from math import cos, sin
from mathutils import Vector


def read_body(source):
    vertices = []
    faces = []
    group = ''
    for line in source.read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == 'v':
            vertices.append(Vector(tuple(map(float, fields[1:4]))))
        if fields[0] == 'g':
            group = fields[1]
        if fields[0] == 'f' and group == 'body':
            faces.append([int(value.split('/')[0]) - 1 for value in fields[1:]])
    return vertices, faces


def simplify(vertices, faces, name, contains, transform, target):
    included_faces = [face for face in faces if all(contains(vertices[i]) for i in face)]
    selected = sorted({i for face in included_faces for i in face})
    indices = {old: new for new, old in enumerate(selected)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([transform(vertices[i]) for i in selected], [],
                     [[indices[i] for i in face] for face in included_faces])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Browser triangle budget', 'DECIMATE')
    modifier.ratio = min(1, target / sum(len(p.vertices) - 2 for p in mesh.polygons))
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles()
    return ([tuple(v.co) for v in obj.data.vertices],
            [i for triangle in obj.data.loop_triangles for i in triangle.vertices])


def make_glb(parts):
    binary = bytearray()
    content = {'asset': {'version': '2.0', 'generator': 'FRI VIND · MakeHuman CC0'},
               'bufferViews': [], 'accessors': [], 'meshes': [], 'nodes': []}

    def accessor(data, fmt, component, count, element, target, bounds=None):
        offset = len(binary)
        binary.extend(struct.pack('<' + fmt * len(data), *data))
        view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset, 'target': target}
        binary.extend(b'\0' * (-len(binary) % 4))
        content['bufferViews'].append(view)
        item = {'bufferView': len(content['bufferViews']) - 1, 'componentType': component, 'count': count, 'type': element}
        if bounds:
            item['min'], item['max'] = bounds
        content['accessors'].append(item)
        return len(content['accessors']) - 1

    for name, (points, faces) in parts.items():
        position = accessor([c for point in points for c in point], 'f', 5126, len(points), 'VEC3', 34962,
                            ([min(axis) for axis in zip(*points)], [max(axis) for axis in zip(*points)]))
        index = accessor(faces, 'H', 5123, len(faces), 'SCALAR', 34963)
        content['nodes'].append({'mesh': len(content['meshes'])})
        content['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': position}, 'indices': index}]})
    content['scene'] = 0
    content['scenes'] = [{'nodes': list(range(len(parts)))}]
    content['buffers'] = [{'byteLength': len(binary)}]
    description = json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()
    description += b' ' * (-len(description) % 4)
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(description) + len(binary))
            + struct.pack('<I4s', len(description), b'JSON') + description
            + struct.pack('<I4s', len(binary), b'BIN\0') + binary)


source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
vertices, faces = read_body(source)
head_centre = Vector((0, 7.29, .37))
arm_origin = Vector((4.312, 2.452, 1.757))
hand_axis = (Vector((4.784, 1.303, 3.015)) - arm_origin).normalized()
hand_across = hand_axis.cross(Vector((-1, -.35, -.02))).normalized()
hand_normal = hand_across.cross(hand_axis)


def grip(point):
    point = (point - arm_origin) * .10
    x, y, z = point.dot(hand_across), point.dot(hand_axis), point.dot(hand_normal)
    hinge = .067
    if y > hinge:
        radius = .049
        angle = (y - hinge) / radius
        y = hinge + (radius - z) * sin(angle)
        z = radius - (radius - z) * cos(angle)
    return (x, y - .058, z - .006)


parts = {}
for suffix, head_budget, hand_budget in [('', 1300, 490), ('Far', 300, 116)]:
    parts['head' + suffix] = simplify(vertices, faces, 'head' + suffix, lambda v: v.y > 6.07,
                                     lambda v: (v - head_centre) * .103, head_budget)
    parts['grip' + suffix] = simplify(vertices, faces, 'grip' + suffix,
                                     lambda v: v.x > 3.95 and (v - arm_origin).dot(hand_axis) > -.14,
                                     grip, hand_budget)
encoded = base64.b64encode(make_glb(parts)).decode()
output.write_text('// Embedded GLB from the MakeHuman base mesh (CC0). See ASSETS.md.\n'
                  'globalThis.FRI_VIND_HUMAN_GLB = ' + json.dumps(encoded) + ';\n')
for name, (points, indices) in parts.items():
    print(f'{name}: {len(points)} vertices, {len(indices) // 3} triangles')
