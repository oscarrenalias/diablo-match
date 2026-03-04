import Phaser from "phaser";
import { PrototypeScene } from "./scenes/PrototypeScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "app",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#10131a",
  pixelArt: true,
  antialias: false,
  antialiasGL: false,
  roundPixels: true,
  scene: [PrototypeScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
};

new Phaser.Game(config);
