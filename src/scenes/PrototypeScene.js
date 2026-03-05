import Phaser from "phaser";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../game/constants.js";
import { areAdjacent, findLegalMoves } from "../game/board.js";
import { createGameEngine } from "../game/engine.js";
import { BoardEffects } from "../ui/BoardEffects.js";
import { CombatHUD } from "../ui/CombatHUD.js";
import { IDLE_HINT_DELAY_MS, PHASE_BANNER, RESOLUTION_TIMINGS_MS, SELECTION_VFX, START_OVERLAY_MS } from "../ui/hudConfig.js";

const TILE_SIZE = 64;
const TILE_GAP = 4;

const DEPTH_BOARD = 10;
const DEPTH_BOARD_GLOW = 11;
const DEPTH_BOARD_FRAME = 12;
const DEPTH_OVERLAY = 14;
const DEPTH_EFFECTS = 22;
const DEPTH_HUD = 30;
const DEPTH_DEV_PANEL = 60;
const DEPTH_MODAL = 80;
const BASE_URL = import.meta.env.BASE_URL;

function downloadTextFile(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function capWord(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function collectMatchedIndices(matches) {
  const unique = new Set();
  for (const group of matches) {
    for (const index of group) {
      unique.add(index);
    }
  }
  return [...unique];
}

export class PrototypeScene extends Phaser.Scene {
  constructor() {
    super("prototype-scene");

    this.engine = null;
    this.selectedIndex = null;
    this.savedReplay = null;
    this.logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
    this.logLevelIndex = 1;
    this.currentClass = "warrior";

    this.baseTileSprites = [];
    this.baseTileFrames = [];
    this.baseTileGlows = [];
    this.viewBoard = [];

    this.isAnimatingBoard = false;
    this.isModalBlockingInput = false;
    this.pendingResize = false;

    this.hintIndices = [];
    this.hintTween = null;
    this.lastInteractionAt = 0;

    this.lastProcessedEventIndex = 0;
    this.activeEnemyId = null;

    this.startOverlayNodes = null;
    this.outcomeModalNodes = null;

    this.devPanelVisible = true;
  }

  preload() {
    this.load.atlas("tiles-atlas", `${BASE_URL}assets/generated/tiles-atlas.png`, `${BASE_URL}assets/generated/tiles-atlas.json`);

    this.load.atlas(
      "ui-portraits-atlas",
      `${BASE_URL}assets/generated/atlas/ui-portraits-atlas.png`,
      `${BASE_URL}assets/generated/atlas/ui-portraits-atlas.json`,
    );
  }

  create() {
    this.cameras.main.setBackgroundColor("#12161f");
    this.textures.get("tiles-atlas").setFilter(Phaser.Textures.FilterMode.NEAREST);

    if (this.textures.exists("ui-portraits-atlas")) {
      this.textures.get("ui-portraits-atlas").setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.createEngine(this.currentClass);
    this.initBoardSprites();
    this.createHudSystems();
    this.createDevPanel();
    this.createStartOverlay();
    this.createOutcomeModal();

    this.lastInteractionAt = this.time.now;
    this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => this.updateIdleHint(),
    });

    this.processNewEngineEvents();
    this.refreshHud();
    this.runEncounterStartSequence();

    this.input.keyboard.on("keydown-D", () => {
      this.devPanelVisible = !this.devPanelVisible;
      this.devPanel.setVisible(this.devPanelVisible);
    });

    this.scale.on("resize", () => {
      if (this.isAnimatingBoard) {
        this.pendingResize = true;
        return;
      }

      this.layoutBoard();
      this.layoutHud();
      this.layoutDevPanel();
      this.layoutOverlayNodes();
      this.refreshHud();
    });
  }

  createEngine(classId) {
    this.currentClass = classId;
    this.engine = createGameEngine({
      seed: "diablo-match-v3",
      classId,
      logLevel: this.logLevels[this.logLevelIndex],
    });

    this.selectedIndex = null;
    this.lastProcessedEventIndex = 0;
    this.activeEnemyId = this.engine.state.enemy?.id ?? null;
    this.clearHint();
  }

  getBoardStart() {
    const totalWidth = BOARD_WIDTH * TILE_SIZE + (BOARD_WIDTH - 1) * TILE_GAP;
    const isNarrow = this.scale.width < 900;
    const y = isNarrow ? 220 : 300;

    return {
      x: Math.round((this.scale.width - totalWidth) / 2),
      y,
    };
  }

  getBoardRect() {
    const start = this.getBoardStart();
    const width = BOARD_WIDTH * TILE_SIZE + (BOARD_WIDTH - 1) * TILE_GAP;
    const height = BOARD_HEIGHT * TILE_SIZE + (BOARD_HEIGHT - 1) * TILE_GAP;

    return {
      x: start.x,
      y: start.y,
      width,
      height,
      left: start.x,
      right: start.x + width,
      bottom: start.y + height,
      cx: start.x + width / 2,
      cy: start.y + height / 2,
    };
  }

  cellTopLeft(index) {
    const { x: startX, y: startY } = this.getBoardStart();
    const x = index % BOARD_WIDTH;
    const y = Math.floor(index / BOARD_WIDTH);
    return {
      x: startX + x * (TILE_SIZE + TILE_GAP),
      y: startY + y * (TILE_SIZE + TILE_GAP),
    };
  }

  cellCenter(index) {
    const topLeft = this.cellTopLeft(index);
    return {
      x: topLeft.x + TILE_SIZE / 2,
      y: topLeft.y + TILE_SIZE / 2,
    };
  }

  createDevButton(container, x, y, label, handler, width = 108) {
    const bg = this.add
      .rectangle(x, y, width, 24, 0x212732, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5e6982)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", handler)
      .setDepth(DEPTH_DEV_PANEL + 1);

    const text = this.add
      .text(x + width / 2, y + 12, label, {
        fontFamily: "Trebuchet MS",
        fontSize: "11px",
        color: "#e6ebf5",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_DEV_PANEL + 1);

    container.add([bg, text]);
  }

  createDevPanel() {
    this.devPanel = this.add.container(12, 8).setDepth(DEPTH_DEV_PANEL);

    const bg = this.add
      .rectangle(0, 0, 454, 92, 0x131821, 0.95)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5a6070)
      .setDepth(DEPTH_DEV_PANEL);

    this.devText = this.add
      .text(8, 6, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#92d5c8",
      })
      .setDepth(DEPTH_DEV_PANEL + 1);

    this.devPanel.add([bg, this.devText]);

    this.createDevButton(this.devPanel, 8, 56, "Export Logs", () => this.onExportLogs(), 84);
    this.createDevButton(this.devPanel, 96, 56, "Save Replay", () => this.onSaveReplay(), 84);
    this.createDevButton(this.devPanel, 184, 56, "Run Replay", () => this.onRunReplay(), 84);
    this.createDevButton(this.devPanel, 272, 56, "Warrior", () => this.onChangeClass("warrior"), 58);
    this.createDevButton(this.devPanel, 334, 56, "Wizard", () => this.onChangeClass("wizard"), 54);
    this.createDevButton(this.devPanel, 392, 56, "Assassin", () => this.onChangeClass("assassin"), 54);
  }

  layoutDevPanel() {
    if (!this.devPanel) {
      return;
    }

    this.devPanel.x = 12;
    this.devPanel.y = 8;
  }

  createHudSystems() {
    const boardRect = this.getBoardRect();

    this.hud = new CombatHUD(this, {
      boardRect,
      heroClass: this.engine.state.player.classId,
      enemyId: this.engine.state.enemy?.id,
      depth: DEPTH_HUD,
    });

    this.hud.setSpellButtons({
      onCastPrimary: () => this.onCastSpell(),
    });

    this.boardEffects = new BoardEffects(this, boardRect, DEPTH_EFFECTS);
    this.layoutHud();
  }

  layoutHud() {
    const boardRect = this.getBoardRect();
    if (this.hud) {
      this.hud.setBoardRect(boardRect);
      this.hud.layout({ width: this.scale.width, height: this.scale.height }, boardRect);
    }

    if (this.boardEffects) {
      this.boardEffects.setBoardRect(boardRect);
    }
  }

  createStartOverlay() {
    const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x090b10, 0.54).setOrigin(0).setDepth(DEPTH_MODAL);
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "46px",
        color: "#f1e0c8",
        stroke: "#18120f",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL + 1);

    bg.setVisible(false);
    text.setVisible(false);
    this.startOverlayNodes = { bg, text };
  }

  createOutcomeModal() {
    const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x07090f, 0.72).setOrigin(0).setDepth(DEPTH_MODAL);

    const panel = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, 420, 300, 0x171a24, 0.96)
      .setDepth(DEPTH_MODAL + 1)
      .setStrokeStyle(2, 0x5f6780);

    const title = this.add
      .text(panel.x, panel.y - 88, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "36px",
        color: "#f0e4d0",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL + 2);

    const body = this.add
      .text(panel.x, panel.y - 24, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "24px",
        color: "#d2d9e6",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL + 2);

    const buttonBg = this.add
      .rectangle(panel.x, panel.y + 92, 190, 48, 0x313746, 1)
      .setDepth(DEPTH_MODAL + 2)
      .setStrokeStyle(2, 0x767f98)
      .setInteractive({ useHandCursor: true });

    const buttonLabel = this.add
      .text(panel.x, panel.y + 92, "", {
        fontFamily: "Trebuchet MS",
        fontSize: "24px",
        color: "#f0f3fb",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_MODAL + 3);

    bg.setVisible(false);
    panel.setVisible(false);
    title.setVisible(false);
    body.setVisible(false);
    buttonBg.setVisible(false);
    buttonLabel.setVisible(false);

    buttonBg.on("pointerup", () => {
      const mode = this.outcomeModalNodes?.mode;
      if (mode === "victory") {
        this.onContinueVictory();
      } else if (mode === "defeat") {
        this.onRestartAfterDefeat();
      }
    });

    this.outcomeModalNodes = {
      bg,
      panel,
      title,
      body,
      buttonBg,
      buttonLabel,
      mode: null,
    };
  }

  layoutOverlayNodes() {
    if (this.startOverlayNodes) {
      this.startOverlayNodes.bg.setSize(this.scale.width, this.scale.height);
      this.startOverlayNodes.text.setPosition(this.scale.width / 2, this.scale.height / 2);
    }

    if (this.outcomeModalNodes) {
      this.outcomeModalNodes.bg.setSize(this.scale.width, this.scale.height);
      this.outcomeModalNodes.panel.setPosition(this.scale.width / 2, this.scale.height / 2);
      this.outcomeModalNodes.title.setPosition(this.scale.width / 2, this.scale.height / 2 - 88);
      this.outcomeModalNodes.body.setPosition(this.scale.width / 2, this.scale.height / 2 - 24);
      this.outcomeModalNodes.buttonBg.setPosition(this.scale.width / 2, this.scale.height / 2 + 92);
      this.outcomeModalNodes.buttonLabel.setPosition(this.scale.width / 2, this.scale.height / 2 + 92);
    }
  }

  async runEncounterStartSequence() {
    if (!this.engine.state.pendingEncounterStart) {
      return;
    }

    this.clearSelection();
    this.clearHint();
    this.isModalBlockingInput = true;

    const text = this.engine.state.currentStarter === "player" ? "PLAYER STARTS" : "ENEMY STARTS";

    this.startOverlayNodes.bg.setAlpha(0);
    this.startOverlayNodes.text.setAlpha(0);
    this.startOverlayNodes.text.setText(text);

    this.startOverlayNodes.bg.setVisible(true);
    this.startOverlayNodes.text.setVisible(true);

    await Promise.all([
      this.tweenPromise({ targets: this.startOverlayNodes.bg, alpha: 0.54, duration: 170, ease: "Sine.easeOut" }),
      this.tweenPromise({ targets: this.startOverlayNodes.text, alpha: 1, duration: 170, ease: "Sine.easeOut" }),
    ]);

    await this.sleep(START_OVERLAY_MS);

    await Promise.all([
      this.tweenPromise({ targets: this.startOverlayNodes.bg, alpha: 0, duration: 150, ease: "Sine.easeIn" }),
      this.tweenPromise({ targets: this.startOverlayNodes.text, alpha: 0, duration: 150, ease: "Sine.easeIn" }),
    ]);

    this.startOverlayNodes.bg.setVisible(false);
    this.startOverlayNodes.text.setVisible(false);

    this.engine.markEncounterIntroShown();
    this.isModalBlockingInput = false;
    this.lastInteractionAt = this.time.now;
    this.refreshHud();

    if (this.engine.state.turnOwner === "enemy" && this.engine.state.outcome === "none") {
      await this.runEnemyTurnsIfNeeded();
    }
  }

  showOutcomeModal({ mode, title, body, buttonText }) {
    this.isModalBlockingInput = true;
    this.outcomeModalNodes.mode = mode;
    this.outcomeModalNodes.title.setText(title);
    this.outcomeModalNodes.body.setText(body);
    this.outcomeModalNodes.buttonLabel.setText(buttonText);

    this.outcomeModalNodes.bg.setVisible(true);
    this.outcomeModalNodes.panel.setVisible(true);
    this.outcomeModalNodes.title.setVisible(true);
    this.outcomeModalNodes.body.setVisible(true);
    this.outcomeModalNodes.buttonBg.setVisible(true);
    this.outcomeModalNodes.buttonLabel.setVisible(true);
  }

  hideOutcomeModal() {
    this.outcomeModalNodes.mode = null;
    this.outcomeModalNodes.bg.setVisible(false);
    this.outcomeModalNodes.panel.setVisible(false);
    this.outcomeModalNodes.title.setVisible(false);
    this.outcomeModalNodes.body.setVisible(false);
    this.outcomeModalNodes.buttonBg.setVisible(false);
    this.outcomeModalNodes.buttonLabel.setVisible(false);

    this.isModalBlockingInput = false;
  }

  onContinueVictory() {
    const result = this.engine.continueAfterVictory();
    if (!result.ok) {
      return;
    }

    this.hideOutcomeModal();
    this.clearSelection();
    this.clearHint();
    this.setViewBoard(this.engine.state.board);
    this.processNewEngineEvents();
    this.refreshHud();
    this.runEncounterStartSequence();
  }

  onRestartAfterDefeat() {
    this.hideOutcomeModal();
    this.resetRun();
  }

  resetRun() {
    this.createEngine(this.currentClass);
    this.engine.state.statusText = `Started new run as ${this.currentClass}.`;

    this.initBoardSprites();

    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    if (this.boardEffects) {
      this.boardEffects.destroy();
      this.boardEffects = null;
    }

    this.createHudSystems();
    this.processNewEngineEvents();
    this.refreshHud();
    this.runEncounterStartSequence();
  }

  initBoardSprites() {
    for (const sprite of this.baseTileSprites) {
      sprite.destroy();
    }
    for (const glow of this.baseTileGlows) {
      glow.destroy();
    }
    for (const frame of this.baseTileFrames) {
      frame.destroy();
    }

    this.baseTileSprites = [];
    this.baseTileFrames = [];
    this.baseTileGlows = [];

    for (let index = 0; index < BOARD_WIDTH * BOARD_HEIGHT; index += 1) {
      const center = this.cellCenter(index);
      const topLeft = this.cellTopLeft(index);

      const sprite = this.add
        .image(center.x, center.y, "tiles-atlas", "weapon")
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(DEPTH_BOARD)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          this.registerPlayerInteraction();
          this.onTileTap(index);
        });

      const glow = this.add
        .rectangle(topLeft.x, topLeft.y, TILE_SIZE, TILE_SIZE, 0xf3f7ff, 0)
        .setOrigin(0)
        .setDepth(DEPTH_BOARD_GLOW)
        .setBlendMode(Phaser.BlendModes.ADD);

      const frame = this.add
        .rectangle(topLeft.x, topLeft.y, TILE_SIZE, TILE_SIZE)
        .setOrigin(0)
        .setFillStyle(0x000000, 0)
        .setStrokeStyle(SELECTION_VFX.idleStrokeWidth, SELECTION_VFX.idleStrokeColor)
        .setDepth(DEPTH_BOARD_FRAME);

      this.baseTileSprites.push(sprite);
      this.baseTileGlows.push(glow);
      this.baseTileFrames.push(frame);
    }

    this.setViewBoard(this.engine.state.board);
  }

  layoutBoard() {
    for (let index = 0; index < BOARD_WIDTH * BOARD_HEIGHT; index += 1) {
      const center = this.cellCenter(index);
      const topLeft = this.cellTopLeft(index);

      const sprite = this.baseTileSprites[index];
      const frame = this.baseTileFrames[index];
      const glow = this.baseTileGlows[index];
      if (!sprite || !frame || !glow) {
        continue;
      }

      sprite.setPosition(center.x, center.y);
      frame.setPosition(topLeft.x, topLeft.y);
      glow.setPosition(topLeft.x, topLeft.y);
    }
  }

  setViewBoard(board) {
    this.viewBoard = board.slice();
    this.applyViewBoardToBaseSprites();
  }

  applyViewBoardToBaseSprites() {
    for (let index = 0; index < this.viewBoard.length; index += 1) {
      const tileType = this.viewBoard[index];
      const sprite = this.baseTileSprites[index];
      if (!sprite) {
        continue;
      }

      if (tileType == null) {
        sprite.setVisible(false);
      } else {
        sprite.setVisible(true);
        sprite.setFrame(tileType);
        sprite.setAlpha(1);
        sprite.setScale(1);
      }
    }

    this.syncSelectionFrames();
  }

  clearSelection() {
    this.selectedIndex = null;
    this.syncSelectionFrames();
  }

  clearHint() {
    this.hintIndices = [];
    if (this.hintTween) {
      this.hintTween.remove();
      this.hintTween = null;
    }
    this.syncSelectionFrames();
  }

  registerPlayerInteraction() {
    this.lastInteractionAt = this.time.now;
    this.clearHint();
  }

  updateIdleHint() {
    if (this.isInputBlocked()) {
      this.clearHint();
      return;
    }

    if (this.engine.state.turnOwner !== "player" || this.engine.state.turnPhase !== "swap") {
      this.clearHint();
      return;
    }

    if (this.selectedIndex != null) {
      this.clearHint();
      return;
    }

    if (this.hintIndices.length > 0) {
      return;
    }

    if (this.time.now - this.lastInteractionAt < IDLE_HINT_DELAY_MS) {
      return;
    }

    const legalMoves = findLegalMoves(this.engine.state.board);
    if (legalMoves.length === 0) {
      return;
    }

    const move = legalMoves[0];
    this.hintIndices = [move.indexA, move.indexB];
    this.syncSelectionFrames();

    const hintSprites = this.hintIndices.map((index) => this.baseTileSprites[index]).filter(Boolean);
    if (hintSprites.length > 0) {
      this.hintTween = this.tweens.add({
        targets: hintSprites,
        alpha: { from: 0.76, to: 1 },
        duration: 420,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  syncSelectionFrames() {
    for (let index = 0; index < this.baseTileFrames.length; index += 1) {
      const frame = this.baseTileFrames[index];
      const glow = this.baseTileGlows[index];
      const sprite = this.baseTileSprites[index];
      const isSelected = this.selectedIndex === index;
      const isHinted = this.hintIndices.includes(index);

      if (!frame || !glow || !sprite) {
        continue;
      }

      if (isSelected) {
        frame.setStrokeStyle(SELECTION_VFX.strokeWidth, SELECTION_VFX.strokeColor);
        glow.setFillStyle(0xf3f7ff, SELECTION_VFX.glowAlpha);
        if (sprite.visible) {
          sprite.setScale(SELECTION_VFX.scale);
        }
      } else if (isHinted) {
        frame.setStrokeStyle(2, 0x8ba9d8);
        glow.setFillStyle(0xa5bcdf, 0.12);
        if (sprite.visible) {
          sprite.setScale(1.03);
        }
      } else {
        frame.setStrokeStyle(SELECTION_VFX.idleStrokeWidth, SELECTION_VFX.idleStrokeColor);
        glow.setFillStyle(0xffffff, 0);
        if (sprite.visible) {
          sprite.setScale(1);
          sprite.setAlpha(1);
        }
      }
    }
  }

  tweenPromise(config) {
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        onComplete: () => resolve(),
      });
    });
  }

  sleep(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  createOverlaySprite(index, tileType) {
    const center = this.cellCenter(index);
    return this.add
      .image(center.x, center.y, "tiles-atlas", tileType)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(DEPTH_OVERLAY)
      .setAlpha(1)
      .setScale(1);
  }

  async animateInvalidSwap(indexA, indexB) {
    const tileA = this.viewBoard[indexA];
    const tileB = this.viewBoard[indexB];
    if (tileA == null || tileB == null) {
      return;
    }

    const spriteA = this.createOverlaySprite(indexA, tileA);
    const spriteB = this.createOverlaySprite(indexB, tileB);

    this.baseTileSprites[indexA].setVisible(false);
    this.baseTileSprites[indexB].setVisible(false);

    const targetA = this.cellCenter(indexB);
    const targetB = this.cellCenter(indexA);

    await Promise.all([
      this.tweenPromise({
        targets: spriteA,
        x: targetA.x,
        y: targetA.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.invalidOut,
      }),
      this.tweenPromise({
        targets: spriteB,
        x: targetB.x,
        y: targetB.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.invalidOut,
      }),
    ]);

    const originA = this.cellCenter(indexA);
    const originB = this.cellCenter(indexB);

    await Promise.all([
      this.tweenPromise({
        targets: spriteA,
        x: originA.x,
        y: originA.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.invalidBack,
      }),
      this.tweenPromise({
        targets: spriteB,
        x: originB.x,
        y: originB.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.invalidBack,
      }),
    ]);

    spriteA.destroy();
    spriteB.destroy();

    this.applyViewBoardToBaseSprites();
  }

  async animateSwapCommit(indexA, indexB) {
    const tileA = this.viewBoard[indexA];
    const tileB = this.viewBoard[indexB];
    if (tileA == null || tileB == null) {
      return;
    }

    const spriteA = this.createOverlaySprite(indexA, tileA);
    const spriteB = this.createOverlaySprite(indexB, tileB);

    this.baseTileSprites[indexA].setVisible(false);
    this.baseTileSprites[indexB].setVisible(false);

    const targetA = this.cellCenter(indexB);
    const targetB = this.cellCenter(indexA);

    await Promise.all([
      this.tweenPromise({
        targets: spriteA,
        x: targetA.x,
        y: targetA.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.swap,
      }),
      this.tweenPromise({
        targets: spriteB,
        x: targetB.x,
        y: targetB.y,
        ease: "Sine.easeInOut",
        duration: RESOLUTION_TIMINGS_MS.swap,
      }),
    ]);

    spriteA.destroy();
    spriteB.destroy();

    const next = this.viewBoard.slice();
    const tmp = next[indexA];
    next[indexA] = next[indexB];
    next[indexB] = tmp;
    this.viewBoard = next;
    this.applyViewBoardToBaseSprites();
  }

  logLineForMatch(match, boardBefore) {
    const tileType = boardBefore[match[0]];
    const tile = capWord(String(tileType ?? "tile"));
    return `${match.length}x ${tile} match`;
  }

  async animateMatchHighlight(indices) {
    if (indices.length === 0) {
      return;
    }

    const nodes = indices.map((index) => {
      const topLeft = this.cellTopLeft(index);
      return this.add
        .rectangle(topLeft.x, topLeft.y, TILE_SIZE, TILE_SIZE)
        .setOrigin(0)
        .setDepth(DEPTH_OVERLAY + 1)
        .setFillStyle(0xe5d9a8, 0.12)
        .setStrokeStyle(2, 0xffe8a6)
        .setAlpha(0.2);
    });

    await this.tweenPromise({
      targets: nodes,
      alpha: 1,
      ease: "Sine.easeInOut",
      duration: Math.floor(RESOLUTION_TIMINGS_MS.matchHighlight / 2),
      yoyo: true,
      repeat: 1,
    });

    for (const node of nodes) {
      node.destroy();
    }
  }

  async animateCascadeStep(cascade) {
    if (cascade.multiplier > 1 && this.boardEffects) {
      this.boardEffects.showCombo(cascade.multiplier);
    }

    for (const match of cascade.matches) {
      this.hud?.pushCombatLog(this.logLineForMatch(match, cascade.boardBefore));
    }

    const matchedIndices = collectMatchedIndices(cascade.matches);
    await this.animateMatchHighlight(matchedIndices);

    const clearOverlays = [];
    for (const index of cascade.clearedIndices) {
      const tileType = cascade.boardBefore[index];
      if (tileType == null) {
        continue;
      }
      clearOverlays.push(this.createOverlaySprite(index, tileType));
      this.baseTileSprites[index].setVisible(false);
    }

    if (clearOverlays.length > 0) {
      await Promise.all(
        clearOverlays.map((overlay) =>
          this.tweenPromise({
            targets: overlay,
            alpha: 0,
            scaleX: 0.72,
            scaleY: 0.72,
            ease: "Sine.easeInOut",
            duration: RESOLUTION_TIMINGS_MS.clear,
          }),
        ),
      );
      for (const overlay of clearOverlays) {
        overlay.destroy();
      }
    }

    for (const index of cascade.clearedIndices) {
      this.viewBoard[index] = null;
    }
    this.applyViewBoardToBaseSprites();

    this.processNewEngineEvents({ maxCascadeLevel: cascade.level });
    this.refreshHud();

    await this.sleep(RESOLUTION_TIMINGS_MS.effectPopups);

    const rowTime = cascade.drops.length > 40 ? RESOLUTION_TIMINGS_MS.fallPerRowHeavy : RESOLUTION_TIMINGS_MS.fallPerRow;
    const dropOverlays = cascade.drops.map((drop) => {
      const overlay = this.createOverlaySprite(drop.from, drop.tile);
      this.baseTileSprites[drop.from].setVisible(false);
      this.baseTileSprites[drop.to].setVisible(false);
      return { overlay, drop };
    });

    if (dropOverlays.length > 0) {
      await Promise.all(
        dropOverlays.map(({ overlay, drop }) => {
          const fromY = Math.floor(drop.from / BOARD_WIDTH);
          const toY = Math.floor(drop.to / BOARD_WIDTH);
          const rows = Math.abs(toY - fromY);
          const duration = Math.min(RESOLUTION_TIMINGS_MS.fallMax, RESOLUTION_TIMINGS_MS.fallBase + rows * rowTime);
          const target = this.cellCenter(drop.to);
          return this.tweenPromise({
            targets: overlay,
            x: target.x,
            y: target.y,
            ease: "Quad.easeIn",
            duration,
          });
        }),
      );

      for (const { overlay, drop } of dropOverlays) {
        overlay.destroy();
        this.viewBoard[drop.from] = null;
        this.viewBoard[drop.to] = drop.tile;
      }

      this.applyViewBoardToBaseSprites();
    }

    const spawnOverlays = cascade.spawns.map((spawn) => {
      const target = this.cellCenter(spawn.index);
      const overlay = this.add
        .image(target.x, target.y - (TILE_SIZE + TILE_GAP), "tiles-atlas", spawn.tile)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setDepth(DEPTH_OVERLAY)
        .setAlpha(0)
        .setScale(0.85);

      this.baseTileSprites[spawn.index].setVisible(false);
      return { overlay, spawn, target };
    });

    if (spawnOverlays.length > 0) {
      await Promise.all(
        spawnOverlays.map(({ overlay, target }) =>
          this.tweenPromise({
            targets: overlay,
            x: target.x,
            y: target.y,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            ease: "Back.easeOut",
            duration: RESOLUTION_TIMINGS_MS.spawn,
          }),
        ),
      );

      for (const { overlay, spawn } of spawnOverlays) {
        overlay.destroy();
        this.viewBoard[spawn.index] = spawn.tile;
      }
      this.applyViewBoardToBaseSprites();
    }
  }

  async animateReshuffle(toBoard) {
    const visibleSprites = this.baseTileSprites.filter((sprite) => sprite.visible);

    if (visibleSprites.length > 0) {
      await this.tweenPromise({
        targets: visibleSprites,
        alpha: 0,
        ease: "Sine.easeInOut",
        duration: 110,
      });
    }

    this.setViewBoard(toBoard);

    const refreshed = this.baseTileSprites.filter((sprite) => sprite.visible);
    for (const sprite of refreshed) {
      sprite.setAlpha(0);
      sprite.setScale(0.92);
    }

    if (refreshed.length > 0) {
      await this.tweenPromise({
        targets: refreshed,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        ease: "Sine.easeInOut",
        duration: 130,
      });
    }
  }

  async animateResolvedSwap(resolved) {
    await this.animateSwapCommit(resolved.indexA, resolved.indexB);

    for (const cascade of resolved.cascades) {
      await this.animateCascadeStep(cascade);
      await this.sleep(RESOLUTION_TIMINGS_MS.cascadePause);
    }

    if (resolved.reshuffled) {
      await this.animateReshuffle(resolved.boardAfter);
    }

    this.setViewBoard(resolved.boardAfter);
    this.processNewEngineEvents();
  }

  lockBoardInput() {
    this.isAnimatingBoard = true;
    this.clearHint();
    this.hud?.setPhaseBanner("", false);
  }

  unlockBoardInput() {
    this.isAnimatingBoard = false;
    if (this.pendingResize) {
      this.pendingResize = false;
      this.layoutBoard();
      this.layoutHud();
      this.layoutDevPanel();
      this.layoutOverlayNodes();
      this.refreshHud();
    }
  }

  isInputBlocked() {
    return (
      this.isAnimatingBoard ||
      this.isModalBlockingInput ||
      this.engine.state.gameOver ||
      this.engine.state.outcome !== "none" ||
      this.engine.state.pendingEncounterStart
    );
  }

  async runEnemyTurnsIfNeeded() {
    if (this.isInputBlocked()) {
      return;
    }

    let guard = 0;
    while (!this.isInputBlocked() && this.engine.state.turnOwner === "enemy" && guard < 4) {
      guard += 1;
      const enemyTurn = this.engine.processEnemyTurn();
      if (!enemyTurn?.ok) {
        break;
      }

      if (enemyTurn.didMove && enemyTurn.resolved?.ok) {
        this.lockBoardInput();
        await this.animateResolvedSwap(enemyTurn.resolved);
        this.unlockBoardInput();
      }

      this.processNewEngineEvents();
      this.refreshHud();

      if (this.engine.state.outcome !== "none") {
        break;
      }
    }
  }

  async onCastSpell() {
    this.registerPlayerInteraction();
    if (this.isInputBlocked()) {
      return;
    }

    const spellId = this.engine.state.player.spells[0];
    const result = this.engine.playerCastSpell(spellId);
    if (!result.ok) {
      this.engine.state.statusText = `Spell failed: ${result.reason}`;
    } else {
      this.hud?.setHeroState("cast");
      this.hud?.pushCombatLog(`Cast ${spellId}`);
    }

    this.processNewEngineEvents();
    this.refreshHud();

    if (this.engine.state.outcome !== "none") {
      return;
    }

    if (this.engine.state.turnOwner === "enemy") {
      await this.runEnemyTurnsIfNeeded();
    }
  }

  onSkipSpell() {
    this.registerPlayerInteraction();
    if (this.isInputBlocked()) {
      return;
    }

    this.engine.skipSpellPhase();
    this.engine.state.statusText = "Spell phase skipped; choose a swap.";
    this.refreshHud();
  }

  onExportLogs() {
    const json = this.engine.exportLogsJson();
    downloadTextFile("diablo-match-log.json", json);
    this.engine.state.statusText = "Logs exported as JSON.";
    this.refreshHud();
  }

  onSaveReplay() {
    this.savedReplay = this.engine.getReplayData();
    this.engine.state.statusText = `Replay saved (${this.savedReplay.actions.length} actions).`;
    this.refreshHud();
  }

  onRunReplay() {
    if (this.isInputBlocked()) {
      return;
    }

    if (!this.savedReplay) {
      this.engine.state.statusText = "No saved replay yet.";
      this.refreshHud();
      return;
    }

    const replayEngine = this.engine.runReplay(this.savedReplay);
    const original = this.engine.getDebugSnapshot();
    const replay = replayEngine.getDebugSnapshot();
    const identical =
      original.boardHash === replay.boardHash &&
      original.enemy.hp === replay.enemy.hp &&
      original.player.hp === replay.player.hp;

    this.engine.state.statusText = identical ? "Replay verification passed (deterministic)." : "Replay mismatch detected.";
    this.refreshHud();
  }

  onCycleLogLevel() {
    this.logLevelIndex = (this.logLevelIndex + 1) % this.logLevels.length;
    this.engine.setLogLevel(this.logLevels[this.logLevelIndex]);
    this.engine.state.statusText = `Log level: ${this.logLevels[this.logLevelIndex]}`;
    this.refreshHud();
  }

  onChangeClass(classId) {
    if (this.isAnimatingBoard) {
      return;
    }

    this.currentClass = classId;
    this.resetRun();
  }

  async onTileTap(index) {
    if (this.isInputBlocked()) {
      return;
    }

    if (this.engine.state.turnOwner !== "player") {
      this.engine.state.statusText = "Wait for your turn.";
      this.refreshHud();
      return;
    }

    if (this.engine.state.turnPhase === "spell") {
      this.engine.skipSpellPhase();
      this.engine.state.statusText = "Spell phase auto-skipped.";
    }

    if (this.selectedIndex == null) {
      this.selectedIndex = index;
      this.engine.state.statusText = "Tile selected. Tap an adjacent tile.";
      this.syncSelectionFrames();
      this.refreshHud();
      return;
    }

    if (this.selectedIndex === index) {
      this.selectedIndex = null;
      this.engine.state.statusText = "Selection cleared.";
      this.syncSelectionFrames();
      this.refreshHud();
      return;
    }

    if (!areAdjacent(this.selectedIndex, index, BOARD_WIDTH, BOARD_HEIGHT)) {
      this.selectedIndex = index;
      this.engine.state.statusText = "Selection moved.";
      this.syncSelectionFrames();
      this.refreshHud();
      return;
    }

    const indexA = this.selectedIndex;
    const indexB = index;
    this.selectedIndex = null;
    this.syncSelectionFrames();

    const result = this.engine.playerSwap(indexA, indexB, { autoEnemyTurn: false });
    if (!result.ok) {
      this.engine.state.statusText = result.reason === "non_adjacent" ? "Tiles must be adjacent." : "Swap must create a match.";

      if (result.reason === "no_match") {
        this.lockBoardInput();
        await this.animateInvalidSwap(indexA, indexB);
        this.unlockBoardInput();
      }

      this.processNewEngineEvents();
      this.refreshHud();
      return;
    }

    this.lockBoardInput();
    await this.animateResolvedSwap(result);
    this.unlockBoardInput();

    this.processNewEngineEvents();
    this.refreshHud();

    if (this.engine.state.outcome !== "none") {
      return;
    }

    if (this.engine.state.turnOwner === "enemy") {
      await this.runEnemyTurnsIfNeeded();
    }

    this.engine.state.statusText = `Swap resolved: ${result.cascades.length} cascades.`;
    this.refreshHud();
  }

  processNewEngineEvents({ maxCascadeLevel = null } = {}) {
    const events = this.engine.state.logger.getEvents();
    const startIndex = this.lastProcessedEventIndex;
    const boundedTypes = new Set(["swap_attempt", "match_found", "cascade_step", "match_resolved", "damage_application", "board_reshuffle"]);
    const leveledTypes = new Set(["cascade_step", "match_resolved", "damage_application"]);

    const shouldStopForCascadeWindow = (event) => {
      if (maxCascadeLevel == null) {
        return false;
      }

      if (!boundedTypes.has(event.type)) {
        return true;
      }

      if (leveledTypes.has(event.type)) {
        const level = event?.payload?.level;
        if (typeof level === "number" && level > maxCascadeLevel) {
          return true;
        }
      }

      return false;
    };

    let i = startIndex;
    for (; i < events.length; i += 1) {
      const event = events[i];
      const { type, payload } = event;

      if (shouldStopForCascadeWindow(event)) {
        break;
      }

      if (type === "spell_cast" && payload.caster === this.engine.state.player.name) {
        this.hud?.setHeroState("cast");
        this.hud?.pushCombatLog(`Spell: ${payload.spellId}`);
      }

      if (type === "damage_application") {
        const dmg = payload.detail?.damage?.finalDamage ?? 0;
        const byPlayer = payload.by === this.engine.state.player.name;

        if (dmg > 0) {
          const targetIsPlayer = payload.to === this.engine.state.player.name;
          this.boardEffects?.showDamage(dmg, targetIsPlayer ? "hero" : "enemy");
          this.hud?.pushCombatLog(`${payload.by} -> ${payload.to}: ${dmg} dmg`);

          if (targetIsPlayer) {
            this.hud?.setHeroState("hurt");
          } else if (byPlayer && payload.detail?.type === "weapon_damage") {
            this.hud?.setHeroState("attack");
          }
        }

        if (payload.detail?.type === "mana_gain") {
          this.boardEffects?.showManaGain(payload.detail.gain ?? 0, byPlayer ? "hero" : "enemy");
        }
        if (payload.detail?.type === "armor_gain") {
          this.boardEffects?.showArmorGain(payload.detail.gain ?? 0, byPlayer ? "hero" : "enemy");
        }
        if (payload.detail?.type === "gold_gain") {
          this.boardEffects?.showGoldGain(payload.detail.gain ?? 0, "hero");
          this.hud?.setHeroState("coin");
        }
      }

      if (type === "encounter_victory") {
        this.hud?.setHeroState("victory");
        this.hud?.pushCombatLog("Victory!");
        this.showOutcomeModal({
          mode: "victory",
          title: "VICTORY",
          body: "XP gained: 0\nGold found: 0",
          buttonText: "Continue",
        });
      }

      if (type === "encounter_defeat") {
        this.showOutcomeModal({
          mode: "defeat",
          title: "YOU DIED",
          body: "Your run has ended.",
          buttonText: "Restart",
        });
      }

      if (type === "encounter_start") {
        const enemyId = this.engine.state.enemy?.id;
        if (enemyId && enemyId !== this.activeEnemyId) {
          this.activeEnemyId = enemyId;
          this.hud?.resetHeroForEncounter();
          this.hud?.setEnemyPortrait(enemyId);
          this.hud?.clearCombatLog();
          this.hud?.pushCombatLog(`Encounter: ${this.engine.state.enemy.name}`);
        }
      }

      if (type === "match_resolved") {
        const tile = capWord(String(payload.tileType ?? "tile"));
        this.hud?.pushCombatLog(`${payload.size}x ${tile}`);
      }

      if (type === "extra_turn_granted") {
        this.boardEffects?.showExtraTurn();
        this.hud?.pushCombatLog("Extra turn!");
      }
    }

    this.lastProcessedEventIndex = i;
  }

  refreshHud() {
    const snapshot = this.engine.getDebugSnapshot();
    this.layoutHud();

    if (this.hud) {
      this.hud.updateVitals({
        hero: {
          hp: snapshot.player.hp,
          maxHp: snapshot.player.maxHp,
          mana: snapshot.player.mana,
          maxMana: 30,
          armor: snapshot.player.armor,
          name: snapshot.player.name,
        },
        enemy: {
          hp: snapshot.enemy.hp,
          maxHp: snapshot.enemy.maxHp,
          mana: snapshot.enemy.mana,
          maxMana: 10,
          armor: snapshot.enemy.armor,
          name: snapshot.enemy.name,
        },
      });

      this.hud.setTurnPhaseLabel(`${capWord(snapshot.turnOwner)} Turn`);
      this.hud.setTurnOwner(snapshot.turnOwner);

      const shouldShowPhaseBanner =
        snapshot.turnOwner === "player" &&
        snapshot.outcome === "none" &&
        !snapshot.pendingEncounterStart &&
        !this.isAnimatingBoard &&
        !this.isModalBlockingInput;

      if (shouldShowPhaseBanner) {
        this.hud.setPhaseBanner(snapshot.turnPhase === "spell" ? PHASE_BANNER.castText : PHASE_BANNER.swapText, true);
      } else {
        this.hud.setPhaseBanner("", false);
      }

      if (this.activeEnemyId !== this.engine.state.enemy?.id) {
        this.activeEnemyId = this.engine.state.enemy?.id ?? null;
        if (this.activeEnemyId) {
          this.hud.setEnemyPortrait(this.activeEnemyId);
        }
      }
    }

    this.devText.setText(
      [
        `status=${this.engine.state.statusText || "ready"}`,
        `seed=${snapshot.seed} class=${this.currentClass}`,
        `turn=${snapshot.turnOwner}/${snapshot.turnPhase} outcome=${snapshot.outcome}`,
        `anim=${this.isAnimatingBoard} modal=${this.isModalBlockingInput} intro=${snapshot.pendingEncounterStart}`,
        `boardHash=${snapshot.boardHash}`,
        `cascade=${snapshot.cascadeLevel} x${snapshot.cascadeMultiplier}`,
        `delta=${JSON.stringify(snapshot.resourceDelta)}`,
        `log=${this.logLevels[this.logLevelIndex]}`,
      ].join("\n"),
    );
  }
}
