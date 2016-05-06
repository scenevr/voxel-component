/* globals AFRAME, THREE, XMLHttpRequest */
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

var createAOMesh = require('ao-mesher');
var voxToNdarray = require('vox-to-ndarray');
var zeros = require('zeros');
var palette = require('./palette');

/**
 * Voxel component for A-Frame.
 */
AFRAME.registerComponent('voxel', {
  dependencies: ['material'],

  schema: {
    src: {
    },
    ambientOcclusion: {
      default: true
    },
    color: {
      default: false
    }
  },

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    var self = this;

    var r = new XMLHttpRequest();
    r.onload = function () {
      console.log(r.response.byteLength);
      self.loadVox(r.response);
    };
    r.responseType = 'arraybuffer';
    r.open('GET', this.data.src);
    r.send();
  },

  loadVox: function (buffer) {
    this.voxels = voxToNdarray(buffer);
    this.resolution = this.voxels.shape;
    this.generateMeshFromVoxels();
  },

  generateMeshFromVoxels: function () {
    var padding = this.resolution.map(function (r) { return r + 2; });
    var voxelsWithPadding = zeros(padding, 'int32');

    var x, y, z;

    for (x = 0; x < this.resolution[0]; x++) {
      for (y = 0; y < this.resolution[1]; y++) {
        for (z = 0; z < this.resolution[2]; z++) {
          // fixme - copy a row at a time for speeed
          var v = this.voxels.get(x, y, z);
          v = v ? (1 << 15 | v) : 0;
          voxelsWithPadding.set(x + 1, y + 1, z + 1, v);
        }
      }
    }

    var material = new THREE.MeshLambertMaterial();

    if (!this.data.color) {
      material = this.el.components.material.material;
    }

    material.setValues({
      vertexColors: THREE.VertexColors
    });

    // Create mesh
    var vertData = createAOMesh(voxelsWithPadding);

    // Create geometry
    var geometry = new THREE.Geometry();
    var face = 0;
    var collisionVertices = [];
    var collisionIndices = [];
    var vertices = new Float32Array(vertData.length / 8);

    var uvs = geometry.faceVertexUvs[0] = [];

    var i = 0;
    var j = 0;
    while (i < vertData.length) {
      var v = new THREE.Vector3(-this.resolution[0] / 2, 0, -this.resolution[0] / 2).round();
      var s = 1.0;
      var texture = vertData[i + 7];

      var uvSet = [];
      var uv;

      uv = new THREE.Vector2();
      uv.x = vertices[j++] = vertData[i + 0] + v.x
      uv.y = vertices[j++] = vertData[i + 1] + v.y
      uv.x += vertices[j++] = vertData[i + 2] + v.z
      geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
      collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
      uvSet.push(uv)
      i += 8

      uv = new THREE.Vector2()
      uv.x = vertices[j++] = vertData[i + 0] + v.x
      uv.y = vertices[j++] = vertData[i + 1] + v.y
      uv.x += vertices[j++] = vertData[i + 2] + v.z
      geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
      collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
      uvSet.push(uv)
      i += 8

      uv = new THREE.Vector2()
      uv.x = vertices[j++] = vertData[i + 0] + v.x
      uv.y = vertices[j++] = vertData[i + 1] + v.y
      uv.x += vertices[j++] = vertData[i + 2] + v.z
      geometry.vertices.push(new THREE.Vector3(vertData[i + 0], vertData[i + 1], vertData[i + 2]).add(v).multiplyScalar(s))
      collisionVertices.push((vertData[i + 0] + v.x) * s, (vertData[i + 1] + v.y) * s, (vertData[i + 2] + v.z) * s)
      uvSet.push(uv)
      i += 8

      var f = new THREE.Face3( face + 0, face + 1, face + 2 )

      if (this.data.color && this.data.ambientOcclusion){
        f.vertexColors = [
          palette[texture].clone().multiplyScalar(vertData[i - 24 + 3] / 255.0),
          palette[texture].clone().multiplyScalar(vertData[i - 16 + 3] / 255.0),
          palette[texture].clone().multiplyScalar(vertData[i - 8 + 3] / 255.0)
        ];
      } else if (this.data.color) {
        f.vertexColors = [
          palette[texture],
          palette[texture],
          palette[texture]
        ];
      } else if (this.data.ambientOcclusion) {
        f.vertexColors = [
          new THREE.Color().setHSL(0, 0, vertData[i - 24 + 3] / 255.0),
          new THREE.Color().setHSL(0, 0, vertData[i - 16 + 3] / 255.0),
          new THREE.Color().setHSL(0, 0, vertData[i - 8 + 3] / 255.0)
        ];
      }

      geometry.faces.push(f)
      uvs.push(uvSet) // [new THREE.Vector2(1,1), new THREE.Vector2(0, 1), new THREE.Vector2(0, 0)])
      collisionIndices.push(face + 0, face + 1, face + 2)
      face += 3
    }

    geometry.computeBoundingSphere();
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    this.mesh = new THREE.Mesh(geometry, material); 
    this.el.setObject3D('mesh', this.mesh);
  },

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
  update: function (oldData) { },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () { },

  /**
   * Called on each scene tick.
   */
  // tick: function (t) { },

  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   */
  pause: function () { },

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   */
  play: function () { },
});
