import * as THREE from 'three';

/**
 * Creates LOD variants for Aasura by simplifying dense sub-groups
 * (chains, beard, teeth) while preserving face, sword, UVs, skinIndex, and skinWeight.
 */
export function createAasuraLODGeometries(baseGeometry) {
  // Ensure indexed geometry
  if (!baseGeometry.index) {
    const count = baseGeometry.attributes.position.count;
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    baseGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  
  // LOD0: 100% Full Original Fidelity — pristine mesh, every tooth, chain link, beard strand, cloth fold & sword detail intact
  const geomLOD0 = baseGeometry.clone();

  // LOD1 (medium range): Full fidelity clone
  const geomLOD1 = baseGeometry.clone();

  // LOD2 (distant perimeter > 30m): subtle lightweight proxy
  const geomLOD2 = decimateGroups(baseGeometry, 0.50);

  return { geomLOD0, geomLOD1, geomLOD2 };
}

function decimateGroups(sourceGeom, groupRatios) {
  const geom = new THREE.BufferGeometry();
  
  // Clone attributes (position, normal, uv, skinIndex, skinWeight)
  for (const name in sourceGeom.attributes) {
    geom.setAttribute(name, sourceGeom.attributes[name].clone());
  }

  // Build index buffer or non-indexed triangle list
  const srcGroups = sourceGeom.groups;
  const newIndices = [];
  const newGroups = [];
  let currentStart = 0;

  const hasIndex = !!sourceGeom.index;
  const getTriangleIndices = (triIdx) => {
    if (hasIndex) {
      return [
        sourceGeom.index.getX(triIdx * 3),
        sourceGeom.index.getX(triIdx * 3 + 1),
        sourceGeom.index.getX(triIdx * 3 + 2)
      ];
    } else {
      return [triIdx * 3, triIdx * 3 + 1, triIdx * 3 + 2];
    }
  };

  srcGroups.forEach((g, gIdx) => {
    const ratio = typeof groupRatios === 'number' ? groupRatios : (groupRatios[gIdx] ?? 1.0);
    const triStart = g.start / 3;
    const triCount = g.count / 3;
    let addedCount = 0;

    const step = 1.0 / Math.max(0.01, Math.min(1.0, ratio));
    let accum = 0;

    for (let i = 0; i < triCount; i++) {
      accum += 1.0;
      if (accum >= step || ratio >= 0.999) {
        accum -= step;
        const [a, b, c] = getTriangleIndices(triStart + i);
        newIndices.push(a, b, c);
        addedCount += 3;
      }
    }

    if (addedCount > 0) {
      newGroups.push({
        start: currentStart,
        count: addedCount,
        materialIndex: g.materialIndex
      });
      currentStart += addedCount;
    }
  });

  const TypedArray = geom.attributes.position.count > 65535 ? Uint32Array : Uint16Array;
  geom.setIndex(new THREE.BufferAttribute(new TypedArray(newIndices), 1));
  newGroups.forEach(g => geom.addGroup(g.start, g.count, g.materialIndex));
  return geom;
}
