import "./styles.css";
import loadTexture from "./util/texture-loader";
import loadModel from "./util/model-loader";
import * as THREE from "three";
import BackfaceMaterial from "./backface-material";
import RefractionMaterial from "./refraction-material";

class App {
  constructor() {
    this.render = this.render.bind(this);
    this.resize = this.resize.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    this.vp = {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Math.min(devicePixelRatio, 2 || 1)
    };

    this.velocity = 0.005;
    this.pointerDown = false;
    this.pointer = {
      x: 0,
      y: 0
    };

    //NOTE: when necassary the creation of this array could be automated when a parcel build is triggered
    this.texturePaths = [
      "/images/texture-0.jpg", 
      "/images/texture-1.jpg", 
      "/images/texture-2.jpg", 
      "/images/texture-3.jpg"
    ];
    this.textures = [];
    this.textureId = 0;
    this.nav = [-1, 0, 1]

    this.setup();
  }

  addEvents() {
    if ("ontouchmove" in window) {
      window.addEventListener("touchstart", this.handleMouseDown);
      window.addEventListener("touchmove", this.handleMouseMove);
      window.addEventListener("touchend", this.handleMouseUp);
    } else {
      window.addEventListener("mousedown", this.handleMouseDown);
      window.addEventListener("mousemove", this.handleMouseMove);
      window.addEventListener("mouseup", this.handleMouseUp);
    }
  }

  async setup() {
    this.createScene();
    await this.loadTextures();
    this.nav[0] = this.textures.length - 1; 

    this.envFbo = new THREE.WebGLRenderTarget(
      this.vp.width * this.vp.dpr,
      this.vp.height * this.vp.dpr
    );
    this.backfaceFbo = new THREE.WebGLRenderTarget(
      this.vp.width * this.vp.dpr,
      this.vp.height * this.vp.dpr
    );

    this.quad = await this.createBackground();
    this.scene.add(this.quad);

    this.model = await this.createModel();
    this.scene.add(this.model);

    this.camera.position.z = 5;
    this.orthoCamera.position.z = 5;

    window.addEventListener("resize", this.resize);

    this.addEvents();
    this.render();
  }

  createScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.vp.width / this.vp.height,
      0.1,
      1000
    );
    this.orthoCamera = new THREE.OrthographicCamera(
      this.vp.width / -2,
      this.vp.width / 2,
      this.vp.height / 2,
      this.vp.height / -2,
      1,
      1000
    );

    this.orthoCamera.layers.set(1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.vp.width, this.vp.height);
    this.renderer.setPixelRatio(this.vp.dpr);
    this.renderer.autoClear = false;
    document.body.appendChild(this.renderer.domElement);
  }

  async loadTextures() {
    for(let path of this.texturePaths) {
      const tex = await loadTexture(path);
      this.textures.push(tex); 
    }
  }

  async createBackground() {
    const tex = this.textures[this.textureId];
    const quad = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    quad.layers.set(1);

    //TODO: calc based on the texture what the scale of the image should be
    quad.scale.set(this.vp.height * 2, this.vp.height, 1);
    return quad;
  }

  async createModel() {
    this.refractionMaterial = new RefractionMaterial({
      envMap: this.envFbo.texture,
      backfaceMap: this.backfaceFbo.texture,
      resolution: [this.vp.width * this.vp.dpr, this.vp.height * this.vp.dpr]
    });

    this.backfaceMaterial = new BackfaceMaterial();

    let { model } = await loadModel("/diamond.glb");
    return model.children[0];
  }

  switchTexture() {
    this.quad.material.map = this.textures[this.textureId];
    this.quad.material.needsUpdate = true;
    //TODO: calc based on the texture what the scale of the image should be
    //quad.scale.set(this.vp.height * 2, this.vp.height, 1);
  }

  render() {
    requestAnimationFrame(this.render);

    this.renderer.clear();

    this.velocity *= 0.87;
    this.model.rotation.y +=
      this.velocity +
      Math.sign(this.velocity) * 0.005 * (1 - Number(this.pointerDown));

    // render env to fbo
    this.renderer.setRenderTarget(this.envFbo);
    this.renderer.render(this.scene, this.orthoCamera);

    // render cube backfaces to fbo
    this.model.material = this.backfaceMaterial;
    this.renderer.setRenderTarget(this.backfaceFbo);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);

    // render env to screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.orthoCamera);
    this.renderer.clearDepth();

    // render cube with refraction material to screen
    this.model.material = this.refractionMaterial;
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.vp.width = window.innerWidth;
    this.vp.height = window.innerHeight;

    this.renderer.setSize(this.vp.width, this.vp.height);
    this.envFbo.setSize(
      this.vp.width * this.vp.dpr,
      this.vp.height * this.vp.dpr
    );
    this.backfaceFbo.setSize(
      this.vp.width * this.vp.dpr,
      this.vp.height * this.vp.dpr
    );

    this.quad.scale.set(this.vp.height * 2, this.vp.height, 1);

    this.model.material.uniforms.resolution.value = [
      this.vp.width * this.vp.dpr,
      this.vp.height * this.vp.dpr
    ];

    this.camera.aspect = this.vp.width / this.vp.height;
    this.camera.updateProjectionMatrix();

    this.orthoCamera.left = this.vp.width / -2;
    this.orthoCamera.right = this.vp.width / 2;
    this.orthoCamera.top = this.vp.height / 2;
    this.orthoCamera.bottom = this.vp.height / -2;
    this.orthoCamera.updateProjectionMatrix();
  }

  getActiveSection() {
    const sectionWidth = this.vp.width / this.nav.length; 
    const section = Object.keys(this.nav)[Math.floor(this.pointer.x /sectionWidth)]; 
    return section;
  }

  recalcSections(baseSection) {
    this.nav[baseSection] = this.textureId;
    console.log(`base section: ${baseSection}, texture: ${this.textureId}`)

    for(let [section, texture] of this.nav.entries()) {
      if(section == baseSection) {
        continue;
      }

      const distanceFromBase = section - baseSection;
      let textureId = this.textureId + distanceFromBase;

      if(textureId < 0) {
        textureId = this.texturePaths.length + distanceFromBase; 
      }

      if(textureId > this.texturePaths.length - 1) {
        textureId = textureId - this.texturePaths.length; 
      }

      this.nav[section] = textureId;
      console.log(`section: ${section}, texture: ${textureId}`)
    }
  }

  handleMouseDown(e) {
    this.pointerDown = true;
    this.pointer.x = e.touches ? e.touches[0].clientX : e.clientX;
    this.recalcSections(this.getActiveSection());
  }

  handleMouseMove(e) {
    if (!this.pointerDown) return;

    const x = e.touches ? e.touches[0].clientX : e.clientX;
    this.velocity += (x - this.pointer.x) * 0.001;
    this.pointer.x = x;

    const sectionTextureId = this.nav[this.getActiveSection()];

    if(this.textureId == sectionTextureId || sectionTextureId == undefined) {
      return;
    }

    this.textureId = sectionTextureId;
    this.switchTexture();
  }

  handleMouseUp() {
    this.pointerDown = false;
  }
}

new App();
