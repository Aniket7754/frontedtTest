// src/Container3DView.js
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const Container3DView = ({ products, containerDimensions }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(800, 400, 800);
    camera.lookAt(scene.position);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(500, 1000, 500);
    scene.add(ambientLight, dirLight);

    // Container box (wireframe with transparent walls)
    const { L, W, H } = containerDimensions;
    const containerGeometry = new THREE.BoxGeometry(L, H, W);
    const containerMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      opacity: 0.15,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const containerMesh = new THREE.Mesh(containerGeometry, containerMaterial);
    containerMesh.position.y = H / 2;
    scene.add(containerMesh);

    // Container outline
    const edges = new THREE.EdgesGeometry(containerGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const lineSegments = new THREE.LineSegments(edges, lineMaterial);
    lineSegments.position.y = H / 2;
    scene.add(lineSegments);

    // Draw product boxes
    let offsetX = -L / 2 + 10;
    let offsetZ = -W / 2 + 10;
    let offsetY = 0;

    products.forEach((product) => {
      const { L: l, w, h } = product.dimensions;
      const qty = parseInt(product.quantity);

      if (isNaN(l) || isNaN(w) || isNaN(h) || isNaN(qty)) return;

      for (let i = 0; i < qty; i++) {
        const boxGeometry = new THREE.BoxGeometry(l, h, w);
        const boxMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(`hsl(${(i * 40) % 360}, 60%, 60%)`),
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(offsetX + l / 2, offsetY + h / 2, offsetZ + w / 2);
        scene.add(box);

        offsetX += l + 5;
        if (offsetX + l > L / 2) {
          offsetX = -L / 2 + 10;
          offsetZ += w + 5;
          if (offsetZ + w > W / 2) {
            offsetZ = -W / 2 + 10;
            offsetY += h + 5;
          }
        }
      }
    });

    // Animate
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [products, containerDimensions]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "500px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginTop: "10px",
      }}
    />
  );
};

export default Container3DView;
