import * as THREE from "../../../libs/three/three.module.js";
import * as utils from "../../main/utils.js";

export class TetrahedronDigger {
  isActive = false;

  isLinked = false;

  mode = "inactive";

  polyVisibility = null;

  volumeMesh = null;

  raycaster = null;
  mouse = null;
  // stored event callbacks so they can be removed later
  _onClickMesh1 = null;

  constructor(volumeMesh) {
    this.volumeMesh = volumeMesh;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  setActive(flag) {
    this.isActive = flag;

    const digger = this;
    const meshRenderer = this.volumeMesh.meshRenderer;

    if (flag) {
      // store callbacks so removeEventListener can use the same references
      this._onClickMesh1 = (event) => digger.digPolyhedron(event);

      meshRenderer.renderer.domElement.addEventListener("click", this._onClickMesh1);
    } else {
      if (this._onClickMesh1) {
        meshRenderer.renderer.domElement.removeEventListener("click", this._onClickMesh1);
        this._onClickMesh1 = null;
      }

      this.resetDigger();
    }
  }

  setLinkActive(flag) {
    this.isLinked = flag;

    const volumeMap = this.volumeMesh.volumeMap;
    const otherVolumeMesh = volumeMap.volumeMesh1 === this.volumeMesh ? volumeMap.volumeMesh2 : volumeMap.volumeMesh1;

    if (flag) {
      otherVolumeMesh.digger.polyVisibility = this.polyVisibility;
      otherVolumeMesh.updateVisibleFaces(otherVolumeMesh.meshSlicer.isActive, volumeMap.distortionSlicer.isActive, otherVolumeMesh.digger.isActive);
    } else {
      otherVolumeMesh.digger.polyVisibility = this.polyVisibility.slice();
    }

    otherVolumeMesh.digger.isLinked = flag;
    otherVolumeMesh.controller.diggerLinkToggle.checked = flag;
  }

  digPolyhedron(event) {
    if (!event.altKey) return;
    if (this.mode === "inactive") return;

    const pickedMesh = this.volumeMesh.mesh;

    const meshRenderer = this.volumeMesh.meshRenderer


    const rect = meshRenderer.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, meshRenderer.camera);
    const intersects = this.raycaster.intersectObject(pickedMesh, true);

    if (intersects.length > 0) {
      const polyIndex = pickedMesh.geometry.getAttribute("polyIndex");

      const faceIndex = intersects[0].face.a / 3;
      const pickedPolyhedron = polyIndex.array[faceIndex];

      // If exists, retrieve the last picked polyhedron and restore its color
      if (this.mode === "digger") {
        this.polyVisibility[pickedPolyhedron] = false;
      } else if (this.mode === "undigger") {

        const adjacencyMap = this.volumeMesh.mesh.geometry.userData.adjacencyMap;

        for (const key of adjacencyMap.keys()) {
          const value = adjacencyMap.get(key);

          if (value.length == 2) {
            const poly1 = value[0].polyIndex;
            const poly2 = value[1].polyIndex;

            if (poly1 === pickedPolyhedron && !this.polyVisibility[poly2]) {
              this.polyVisibility[poly2] = true;
              break;
            } else if (poly2 === pickedPolyhedron && !this.polyVisibility[poly1]) {
              this.polyVisibility[poly1] = true;
              break;
            }
          }
        }
      } else if (this.mode === "isolate") {
        this.isolate(pickedPolyhedron);
      }
      this.updateVisibility();
    }

  }

  updateVisibility() {
    const volumeMap = this.volumeMesh.volumeMap;
    const otherVolumeMesh = volumeMap.volumeMesh1 === this.volumeMesh ? volumeMap.volumeMesh2 : volumeMap.volumeMesh1;

    this.volumeMesh.updateVisibleFaces(this.volumeMesh.meshSlicer.isActive, this.volumeMesh.volumeMap.distortionSlicer.isActive, this.isActive);
    if (this.isLinked) {
      otherVolumeMesh.updateVisibleFaces(otherVolumeMesh.meshSlicer.isActive, this.volumeMesh.volumeMap.distortionSlicer.isActive, otherVolumeMesh.digger.isActive);
    }
  }


  updateMesh() {
    const tetrahedra = this.volumeMesh.mesh.geometry.userData.tetrahedra;
    const numTetrahedra = tetrahedra.length / 4;
    this.polyVisibility = new Array(numTetrahedra).fill(true);
  }

  isPolyVisible(polyIndex) {
    return this.polyVisibility[polyIndex];
  }

  setMode(mode) {
    this.mode = mode;

    /*const volumeMap = this.volumeMesh.volumeMap;
    if (!volumeMap) return;

    const otherVolumeMesh = volumeMap.volumeMesh1 === this.volumeMesh ? volumeMap.volumeMesh2 : volumeMap.volumeMesh1;

    otherVolumeMesh.digger.mode = mode;*/
  }

  isolate(pickedPolyhedron) {
    const tetrahedra = this.volumeMesh.mesh.geometry.userData.tetrahedra;
    const numTetrahedra = tetrahedra.length / 4;
    const vertexIndex = new Array;
    for (let i = 0; i < 4; i++) {
      vertexIndex[i] = tetrahedra[pickedPolyhedron * 4 + i];
    }

    for (let j = 0; j < numTetrahedra; j++) {
      const v0 = tetrahedra[j * 4];
      const v1 = tetrahedra[j * 4 + 1];
      const v2 = tetrahedra[j * 4 + 2];
      const v3 = tetrahedra[j * 4 + 3];

      this.polyVisibility[j] = this.polyVisibility[j] &&
        !(
          vertexIndex.includes(v0) ||
          vertexIndex.includes(v1) ||
          vertexIndex.includes(v2) ||
          vertexIndex.includes(v3)
        );

    }

    this.polyVisibility[pickedPolyhedron] = true;

  }

  resetDigger() {
    if (!this.polyVisibility) return;
    this.polyVisibility.fill(true);
    this.updateVisibility();
  }
}