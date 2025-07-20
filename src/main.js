import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

let progress = 0;

function first() {
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms["resolution"].value.set(1 / window.innerWidth, 1 / window.innerHeight);

  gsap.registerPlugin(ScrollTrigger);
  const clock = new THREE.Clock();

  const black = new THREE.Color(0x000000);
  const white = new THREE.Color(0xffffff);
  const orange = new THREE.Color(0xff8000);
  const off_white = new THREE.Color(0xfcfcd7);
  const background_color = new THREE.Color(0x4f2201);
  const background_color_light = new THREE.Color(0xd09b5e);
  const yellow = new THREE.Color(0xfbca92);

  const canvas = document.querySelector("#experience-canvas");
  const size = { width: window.innerWidth, height: window.innerHeight };

  const textureLoader = new THREE.TextureLoader();
  const dracoLoader = new DRACOLoader().setDecoderPath("/draco/");
  const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

  const scene = new THREE.Scene();

  let camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 1000);
  const cameraGroup = new THREE.Group();
  cameraGroup.add(camera);
  scene.add(cameraGroup);
  scene.background = background_color;

  camera.position.set(0, 5, 15);
  let mixer, sunMesh, cam;
  let base = [];

  let envMap = null;
  textureLoader.load("h.jpg", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    envMap = texture;
    envMap.opacity = 0.2;
    envMap.flipY = false;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.encoding = THREE.sRGBEncoding;
  });

  const sunMaterial = new THREE.MeshPhysicalMaterial({
    color: orange,
    roughness: 0, // smooth surface
    metalness: 1,
    emissive: orange,
    emissiveIntensity: 1,
    reflectivity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0,
  });

  const normalMaterial = new THREE.MeshPhysicalMaterial({
    color: off_white,
    emissive: white,
    emissiveIntensity: 0.75,
    opacity: 1,
    roughness: 1,
  });

  const textMaterial = new THREE.MeshPhysicalMaterial({
    color: off_white,
    emissive: white,
    emissiveIntensity: 0.2,

    opacity: 1,
  });

  let liquidMaterial = null;

  textureLoader.load("h.jpg", (texture) => {
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    liquidMaterial = new THREE.MeshPhysicalMaterial({
      depthTest: true,
      depthWrite: true,
      transparent: true,
      map: texture,
      opacity: 1, // Less than 1.0 to see blending
      blending: THREE.SubtractiveBlending, // or NormalBlending, MultiplyBlending, etc.
      iridescence: 1,
    });

    // Optional: apply it to your mesh here if mesh already exists
    // mesh.material = liquidMaterial;
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(black, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // ... after renderer setup ...
  const params = {
    threshold: 0.4,
    strength: 0.2,
    radius: 1,
    exposure: 0.5,
  };

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.6, 0.2);
  bloomPass.threshold = params.threshold;
  bloomPass.strength = params.strength;
  bloomPass.radius = params.radius;

  const outputPass = new OutputPass();
  const composer = new EffectComposer(renderer);
  composer.setSize(size.width, size.height);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.outputEncoding = THREE.sRGBEncoding;
  // Add the bloom pass to the composer
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  gltfLoader.load("/models/sunet-ani.gltf", (gltf) => {
    scene.add(gltf.scene);
    scene.environment = envMap;
    gltf.scene.traverse((child) => {
      if (child.isCamera) cam = child;
    });

    sunMesh = gltf.scene.getObjectByName("SUN");
    mixer = new THREE.AnimationMixer(gltf.scene);

    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.play();
      action.timeScale = 0;
      setupScrollAnimation(action);
    });

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        if (child == sunMesh) {
          child.material = sunMaterial;
          child.geometry.computeVertexNormals();
        } else {
          base.push(child);
          child.material = normalMaterial;
        }
        child.material.needsUpdate = true;
      }
    });
    camera = cam;

    camera.updateProjectionMatrix();
    cameraGroup.clear();
    cameraGroup.add(camera);
  });

  // const cityLoader = new GLTFLoader();
  // cityLoader.load(
  //   "/models/city.gltf", // Path to your gltf/glb file
  //   function (gltf) {
  //     const model = gltf.scene;
  //     model.scale.set(1,1,1);
  //       model.position.set(0,-2,-5);
  //       model.rotation.set(0,3.14,0);
  //     scene.add(model);
  //   },
  //   undefined, // onProgress
  //   function (error) {
  //     console.error('An error happened while loading the model', error);
  //   }
  // );

  // instantiate a loader
  const loader = new SVGLoader();
  const logotype = new THREE.Group();

  loader.load("LOGOTYPE.svg", function (data) {
    const paths = data.paths;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const shapes = SVGLoader.createShapes(path);
      for (let j = 0; j < shapes.length; j++) {
        const shape = shapes[j];
        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, textMaterial);
        logotype.add(mesh);
      }
    }

    // STEP 2: Compute bounding box of entire group
    const box = new THREE.Box3().setFromObject(logotype);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // STEP 3: Reposition group to center at origin
    logotype.children.forEach((child) => {
      child.position.sub(center);
    });
    // STEP 4: Scale + flip Y axis
    logotype.scale.set(0.01, -0.01, 0.01);
    scene.add(logotype);
  });

  window.addEventListener("resize", () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    fxaaPass.material.uniforms["resolution"].value.set(1 / window.innerWidth, 1 / window.innerHeight);

    if (window.activeCamera) {
      window.activeCamera.aspect = camera.aspect;
      window.activeCamera.updateProjectionMatrix();
    }
  });

  // --- Setup GSAP ScrollTrigger Animation ---
  function setupScrollAnimation(action) {
    const clipDuration = action.getClip().duration;
    const tl = gsap.timeline();
    tl.to(action, {
      time: clipDuration,
      ease: "none",
    });
    ScrollTrigger.create({
      trigger: "#canvas-container",
      start: "top top",
      end: "+=1500", // or whatever fits your animation length
      scrub: 0.1,

      animation: tl,
      onUpdate: (self) => {
        const progress = self.progress;
        const clipDuration = action.getClip().duration;
        action.time = clipDuration * progress;
      },
    });
  }

  window.addEventListener("load", () => {
    setTimeout(() => window.scrollTo(0, 0), 0);
  });

  // Prevents the browser from restoring scroll position on refresh
  if (history.scrollRestoration) {
    history.scrollRestoration = "manual";
  } else {
    window.onbeforeunload = function () {
      window.scrollTo(0, 0);
    };
  }
  //////////////////////////////////////////

  const raycaster = new THREE.Raycaster();
  const intersection = {
    intersects: false,
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
  };
  const mouse = new THREE.Vector2();
  const intersects = [];

  function checkIntersection(x, y) {
    if (!camera || !scene) return;
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    raycaster.intersectObjects([sunMesh], false, intersects);

    if (intersects.length > 0) {
      const d = intersects[0].distance;
      const p = intersects[0].point;
      intersection.point.copy(p);

      const normalMatrix = new THREE.Matrix3().getNormalMatrix(sunMesh.matrixWorld);

      const n = intersects[0].face.normal.clone();
      n.applyNormalMatrix(normalMatrix);
      n.multiplyScalar(10);
      n.add(intersects[0].point);

      addCircle(p, n, d);

      intersection.intersects = true;
      intersects.length = 0;
    } else {
      intersection.intersects = false;
    }
  }

  function addCircle(p, n, d) {
    let radius = 0.01 * (1 + d / 5);
    const sphereGeometry = new THREE.SphereGeometry(radius, 32, 16);

    const sphereMesh = new THREE.Mesh(sphereGeometry, liquidMaterial);
    sphereMesh.name = "sphereMesh";
    sphereMesh.position.copy(p);
    const lookAtTarget = p.clone().add(n);
    sphereMesh.lookAt(lookAtTarget);
    const scale = 1;
    sphereMesh.scale.set(scale * (1 + Math.random()), scale * Math.random(), scale);
    scene.add(sphereMesh);
  }

  window.addEventListener("pointermove", onPointerMove);

  const pointer = new THREE.Vector2();
  const targetRotation = new THREE.Euler(); // Where we want to rotate to
  const smoothedRotation = new THREE.Euler(); // Smoothly interpolated rotation

  // Limit max tilt angle in radians
  const maxTiltX = THREE.MathUtils.degToRad(1); // pitch (up/down)
  const maxTiltY = THREE.MathUtils.degToRad(2); // yaw (left/right)

  function onPointerMove(event) {
    if (event.isPrimary) {
      checkIntersection(event.clientX, event.clientY);
    }
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 - 1;

    // Clamp and apply to rotation
    const tiltX = THREE.MathUtils.clamp(pointer.y, -1, 1) * maxTiltX;
    const tiltY = THREE.MathUtils.clamp(pointer.x, -1, 1) * maxTiltY;

    targetRotation.set(tiltX, tiltY, 0); // rotate around X and Y
  }

  let vrem = 0;

  function ease(t) {
    return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
  }

  function render() {
    if (sunMesh) {
      progress = sunMesh.position.y;
    }
    logProgress(progress);
    requestAnimationFrame(render);
    if (mixer) {
      // GSAP sets the time, mixer applies the pose.
      // The delta is still needed for the mixer's internal calculations.
      mixer.update(clock.getDelta());
    }
    // material swap when SUN crosses Y=0
    const sunDown = sunMesh.position.y;
    if (sunMesh && sunDown == 0) {
      scene.background = yellow;

      base.forEach((child) => {
        if (child.isMesh) {
          child.material = sunMaterial;
          child.material.envMap = envMap;
          child.material.needsUpdate = true;
        }
      });
    }
    if (sunMesh && sunDown > 0) {
      scene.background = background_color.clone().lerp(background_color_light, ease((1 - sunDown / 5) * 0.8));
      base.forEach((child) => {
        if (child.isMesh) {
          child.material = normalMaterial;
          child.material.envMap = envMap;
          child.material.needsUpdate = true;
        }
      });
    }

    logotype.position.set(0, sunDown > 1 ? sunDown * 1.1 : 1, -3.5 - sunDown);

    const logotype_scale = 0.015 * (sunDown > 4.75 ? sunDown / 5 : 0);

    logotype.scale.set(logotype_scale, -logotype_scale, logotype_scale);

    let sphereMeshes = scene.children.filter((child) => child.name === "sphereMesh");
    sphereMeshes.forEach((sphereMesh) => {
      sphereMesh.rotation.z += Math.random() * 0.05;
      sphereMesh.scale.x = 0.97 * sphereMesh.scale.x;
      sphereMesh.scale.y = sphereMesh.scale.x;
      sphereMesh.scale.z = sphereMesh.scale.x / 10;
      if (sphereMesh.scale.x < 0.1) {
        sphereMesh.visible = false;
      }
    });

    // Smoothly interpolate toward target rotation
    smoothedRotation.x += (targetRotation.x - smoothedRotation.x) * 0.05;
    smoothedRotation.y += (targetRotation.y - smoothedRotation.y) * 0.05;

    // Apply rotation (camera must NOT use lookAt!)
    cameraGroup.rotation.x = smoothedRotation.x;
    cameraGroup.rotation.y = smoothedRotation.y;

    composer.passes = []; // clear previous passes
    const renderPass = new RenderPass(scene, camera);

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    composer.addPass(fxaaPass);

    composer.render();
    // renderer.render(scene, camera);
  }
  render();
}

function logProgress(progress) {
  const progressSVG = document.getElementById("progress-svg");
  if (!progressSVG) return;
  let percent = 100;
  if (progress > 4.5) {
    percent = 70;
  } else if (progress > 3.5) {
    percent = 50;
  } else if (progress > 1) {
    percent = 30;
  } else {
    percent = 0;
  }
  progressSVG.style.clipPath = `inset(0 ${percent}% 0 0)`;
}

first();
