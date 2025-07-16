import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight
);

gsap.registerPlugin(ScrollTrigger);
const clock = new THREE.Clock();



const canvas = document.querySelector('#experience-canvas');
const size = { width: window.innerWidth, height: window.innerHeight };

const textureLoader = new THREE.TextureLoader();
const dracoLoader = new DRACOLoader().setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 1000);


camera.position.set(0, 5, 15);
let mixer, sunMesh, cam;
let base = [];

let envMap = null;
textureLoader.load('h.jpg', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.rotation = Math.PI / 2; // Rotate the texture to match the scene

  envMap = texture;
  envMap.opacity = 0.2;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.encoding = THREE.sRGBEncoding;
})


const sunMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xff8000,
  
  depthTest: true,
  depthWrite: true,
  transparent: true,
  opacity: 1,
  roughness: 0,
  metalness: 1,
  emissive: 0xff8000,
  emissiveIntensity: 1,
  reflectivity: 0.5,
});

const normalMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xFFFFFF,
  depthTest: true,
  depthWrite: true,
  opacity: 1, 
  sheen: 1,
  sheenColor: 0xFFFFFF,
  roughness: 1,
});


const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 1);
renderer.outputEncoding = THREE.sRGBEncoding;



// ... after renderer setup ...
const params = {
  threshold: 0.4,
  strength: 0.2,
  radius: 1,
  exposure: 0.5
};


const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.2);
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
  gltf.scene.traverse(child => {
    if (child.isCamera) cam = child;
  });
  if (cam) {
    cam.aspect = camera.aspect;
    cam.updateProjectionMatrix();
    camera = cam;
    window.activeCamera = cam;
    window.activeCamera.updateProjectionMatrix();
  }

  sunMesh = gltf.scene.getObjectByName('SUN');
  mixer = new THREE.AnimationMixer(gltf.scene);
  gltf.animations.forEach(clip => {
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.play();
    action.timeScale = 0;
    action.time = 0;
    mixer.update(0); // Update with a delta of 0 to apply the initial pose.
    setupScrollAnimation(action);
  });

  // //add cube to the scene
  // const geometry = new THREE.BoxGeometry(1, 1, 1);
  // const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  // const cube = new THREE.Mesh(geometry, cubeMaterial);
  // cube.position.set(0, 0, -5);      
  // scene.add(cube);


  gltf.scene.traverse(child => {
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

});

window.addEventListener('resize', () => {
  size.width = window.innerWidth;
  size.height = window.innerHeight;
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(size.width, size.height);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  fxaaPass.material.uniforms['resolution'].value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );

  if (window.activeCamera) {
    window.activeCamera.aspect = camera.aspect;
    window.activeCamera.updateProjectionMatrix();
  }
});


// --- Setup GSAP ScrollTrigger Animation ---
function setupScrollAnimation(action) {
  const clipDuration = action.getClip().duration;
  const tl = gsap.timeline();

  ScrollTrigger.create({
    start: "top top",
    end: "bottom bottom",

    scrub: 1,
    animation: tl,
  });

  // Animate the action's time from its start (0) to its end (clipDuration)
  tl.to(action, {
    time: clipDuration,
    duration: clipDuration, // Match GSAP duration for 1:1 mapping
    ease: "none"
  });
}

// Prevents the browser from restoring scroll position on refresh
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
} else {
  window.onbeforeunload = function () {
    window.scrollTo(0, 0);
  };
}

let currentlyHovered = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onMouseMove(event) {
  // No need to run this if the camera or scene isn't ready
  if (!camera || !scene) return;

  // 1. Calculate mouse position in normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // 2. Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // 3. Get a list of objects intersecting the ray
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const firstIntersectedObject = intersects[0].object;
    // Check if the closest intersected object is the one we want
    if (firstIntersectedObject.name === 'SUN') {
      // If we aren't already hovering over this object, log it
      if (currentlyHovered !== firstIntersectedObject) {
        console.log('Hovering over sunMesh');
        currentlyHovered = firstIntersectedObject;
      }
    } else {
      // The mouse is over a different object, so we are no longer hovering the sun.
      currentlyHovered = null;
    }
  } else {
    // The mouse is not over any object.
    currentlyHovered = null;
  }
}

window.addEventListener('mousemove', onMouseMove);


function render() {
  requestAnimationFrame(render);
  if (mixer) {
    // GSAP sets the time, mixer applies the pose.
    // The delta is still needed for the mixer's internal calculations.
    mixer.update(clock.getDelta());
  }
  // material swap when SUN crosses Y=0
  if (sunMesh && sunMesh.position.y <= 0) {
    base.forEach(child => {
      if (child.isMesh) {
        child.material = sunMaterial;
        child.material.envMap = envMap;
        child.material.needsUpdate = true;
      }
  
    }); 
  }
  if (sunMesh && sunMesh.position.y > 0) {
    base.forEach(child => {
      if (child.isMesh) {
        child.material = normalMaterial;
        child.material.envMap = envMap;
        child.material.needsUpdate = true;
      }
    });
  }
  composer.passes = []; // clear previous passes
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  composer.addPass(fxaaPass);

  composer.render();
  // renderer.render(scene, camera);


};
render();