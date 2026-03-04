import Phaser from "phaser";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../game/constants.js";
import { createGameEngine } from "../game/engine.js";

const TILE_SIZE = 64;
const TILE_GAP = 4;

const SWAP_MS = 90;
const INVALID_OUT_MS = 80;
const INVALID_BACK_MS = 70;
const CLEAR_MS = 70;
const FALL_BASE_MS = 60;
const FALL_PER_ROW_MS = 45;
const FALL_PER_ROW_MS_HEAVY = 30;
const FALL_MAX_MS = 220;
const SPAWN_MS = 90;
const CASCADE_GAP_MS = 25;

function shortNum(value) {
  return String(Math.round(value));
}

function downloadTextFile(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export class PrototypeScene extends Phaser.Scene {
  constructor() {
    super("prototype-scene");
    this.engine = null;
    this.selectedIndex = null;
    this.debugVisible = true;
    this.savedReplay = null;
    this.logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
    this.logLevelIndex = 1;
    this.currentClass = "warrior";

    this.baseTileSprites = [];
    this.baseTileFrames = [];
    this.viewBoard = [];

    this.isAnimatingBoard = false;
    this.pendingResize = false;
  }

  preload() {
    this.load.atlas(
      "tiles-atlas",
      "/assets/generated/tiles-atlas.png",
      "/assets/generated/tiles-atlas.json",
    );
  }

  create() {
    this.cameras.main.setBackgroundColor("#12161f");
    this.textures.get("tiles-atlas").setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.createEngine(this.currentClass);
    this.createHud();
    this.initBoardSprites();
    this.refreshHud();

    this.input.keyboard.on("keydown-D", () => {
      this.debugVisible = !this.debugVisible;
      this.refreshHud();
    });

    this.scale.on("resize", () => {
      if (this.isAnimatingBoard) {
        this.pendingResize = true;
        return;
      }

      this.layoutBoard();
      this.layoutPanels();
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
  }

  createButton(x, y, label, onClick, width = 120, fill = 0x283040) {
    const bg = this.add
      .rectangle(x, y, width, 28, fill)
      .setOrigin(0)
      .setStrokeStyle(1, 0x56617a)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", onClick);

    const text = this.add
      .text(x + width / 2, y + 14, label, {
        fontFamily: "Trebuchet MS",
        fontSize: "12px",
        color: "#e5e8ee",
      })
      .setOrigin(0.5);

    return [bg, text];
  }

  createHud() {
    this.hudNodes = [];

    this.titleText = this.add.text(16, 10, "Diablo Match Prototype", {
      fontFamily: "Trebuchet MS",
      fontSize: "22px",
      color: "#dde1e8",
    });

    this.statusText = this.add.text(16, 36, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#b8c1d4",
    });

    this.turnText = this.add.text(16, 58, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "13px",
      color: "#e2dfd7",
    });

    this.playerPanel = this.add.text(16, 82, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "13px",
      color: "#f0f1f4",
      lineSpacing: 3,
    });

    this.enemyPanel = this.add.text(16, 138, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "13px",
      color: "#f0d3d3",
      lineSpacing: 3,
    });

    const buttonRowY = 204;

    this.hudNodes.push(
      ...this.createButton(16, buttonRowY, "Cast Spell", () => this.onCastSpell(), 100),
      ...this.createButton(122, buttonRowY, "Skip Spell", () => this.onSkipSpell(), 100),
      ...this.createButton(228, buttonRowY, "Export Logs", () => this.onExportLogs(), 100),
      ...this.createButton(334, buttonRowY, "Save Replay", () => this.onSaveReplay(), 100),
      ...this.createButton(440, buttonRowY, "Run Replay", () => this.onRunReplay(), 100),
    );

    const classRowY = 236;
    this.hudNodes.push(
      ...this.createButton(16, classRowY, "Warrior", () => this.onChangeClass("warrior"), 90, 0x3a4b2d),
      ...this.createButton(112, classRowY, "Wizard", () => this.onChangeClass("wizard"), 90, 0x2d3f5b),
      ...this.createButton(208, classRowY, "Assassin", () => this.onChangeClass("assassin"), 90, 0x4c2d4b),
      ...this.createButton(304, classRowY, "Toggle Debug", () => this.onToggleDebug(), 110),
      ...this.createButton(420, classRowY, "Log Level", () => this.onCycleLogLevel(), 90),
    );

    const logPanelWidth = 310;
    const logPanelHeight = 240;
    const panelHeaderHeight = 24;
    const logBg = this.add
      .rectangle(0, 0, logPanelWidth, logPanelHeight, 0x1a1f2c, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x44506a);
    const logHeader = this.add
      .rectangle(0, 0, logPanelWidth, panelHeaderHeight, 0x26344b, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5d7394);
    const logHeaderLabel = this.add.text(8, 5, "Combat Log (drag here)", {
      fontFamily: "Trebuchet MS",
      fontSize: "12px",
      color: "#dde7f7",
    });

    this.combatLogText = this.add.text(8, panelHeaderHeight + 6, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "12px",
      color: "#bcc4d3",
      lineSpacing: 2,
      wordWrap: { width: logPanelWidth - 16, useAdvancedWrap: true },
    });

    this.combatLogPanel = this.add
      .container(24, 300, [logBg, logHeader, logHeaderLabel, this.combatLogText])
      .setDepth(30);
    this.combatLogPanel.setSize(logPanelWidth, logPanelHeight);
    logHeader.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, logPanelWidth, panelHeaderHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(logHeader, true);
    logHeader.on("drag", (pointer, dragX, dragY) => {
      const maxX = this.scale.width - logPanelWidth;
      const maxY = this.scale.height - logPanelHeight;
      this.combatLogPanel.x = Phaser.Math.Clamp(dragX, 0, maxX);
      this.combatLogPanel.y = Phaser.Math.Clamp(dragY, 0, maxY);
    });

    const debugPanelWidth = 270;
    const debugPanelHeight = 150;
    const debugBg = this.add
      .rectangle(0, 0, debugPanelWidth, debugPanelHeight, 0x182022, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0x4e6c6e);
    const debugHeader = this.add
      .rectangle(0, 0, debugPanelWidth, panelHeaderHeight, 0x21444b, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0x4e8c92);
    const debugHeaderLabel = this.add.text(8, 5, "Debug Overlay (drag here)", {
      fontFamily: "Trebuchet MS",
      fontSize: "12px",
      color: "#d8f6ef",
    });

    this.debugText = this.add.text(8, panelHeaderHeight + 6, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#93d5c7",
      lineSpacing: 2,
      wordWrap: { width: debugPanelWidth - 16, useAdvancedWrap: true },
    });

    this.debugPanel = this.add
      .container(340, 20, [debugBg, debugHeader, debugHeaderLabel, this.debugText])
      .setDepth(31);
    this.debugPanel.setSize(debugPanelWidth, debugPanelHeight);
    debugHeader.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, debugPanelWidth, panelHeaderHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(debugHeader, true);
    debugHeader.on("drag", (pointer, dragX, dragY) => {
      const maxX = this.scale.width - debugPanelWidth;
      const maxY = this.scale.height - debugPanelHeight;
      this.debugPanel.x = Phaser.Math.Clamp(dragX, 0, maxX);
      this.debugPanel.y = Phaser.Math.Clamp(dragY, 0, maxY);
    });

    this.summaryText = this.add.text(350, 560, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "12px",
      color: "#f2deb0",
      lineSpacing: 2,
    });

    this.layoutPanels();
  }

  layoutPanels() {
    if (this.combatLogPanel) {
      const maxX = this.scale.width - this.combatLogPanel.width;
      const maxY = this.scale.height - this.combatLogPanel.height;
      this.combatLogPanel.x = Phaser.Math.Clamp(this.combatLogPanel.x, 0, maxX);
      this.combatLogPanel.y = Phaser.Math.Clamp(this.combatLogPanel.y, 0, maxY);
    }

    if (this.debugPanel) {
      const maxX = this.scale.width - this.debugPanel.width;
      const maxY = this.scale.height - this.debugPanel.height;
      this.debugPanel.x = Phaser.Math.Clamp(this.debugPanel.x, 0, maxX);
      this.debugPanel.y = Phaser.Math.Clamp(this.debugPanel.y, 0, maxY);
    }

    if (this.summaryText) {
      this.summaryText.x = Math.max(16, this.scale.width - 220);
      this.summaryText.y = Math.max(560, this.scale.height - 100);
    }
  }

  getBoardStart() {
    const totalWidth = BOARD_WIDTH * TILE_SIZE + (BOARD_WIDTH - 1) * TILE_GAP;
    return {
      x: (this.scale.width - totalWidth) / 2,
      y: 300,
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

  initBoardSprites() {
    for (const sprite of this.baseTileSprites) {
      sprite.destroy();
    }
    for (const frame of this.baseTileFrames) {
      frame.destroy();
    }

    this.baseTileSprites = [];
    this.baseTileFrames = [];

    for (let index = 0; index < BOARD_WIDTH * BOARD_HEIGHT; index += 1) {
      const center = this.cellCenter(index);
      const topLeft = this.cellTopLeft(index);

      const sprite = this.add
        .image(center.x, center.y, "tiles-atlas", "weapon")
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.onTileTap(index));

      const frame = this.add
        .rectangle(topLeft.x, topLeft.y, TILE_SIZE, TILE_SIZE)
        .setOrigin(0)
        .setFillStyle(0x000000, 0)
        .setStrokeStyle(2, 0x293242)
        .setDepth(2);

      this.baseTileSprites.push(sprite);
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
      if (!sprite || !frame) {
        continue;
      }

      sprite.setPosition(center.x, center.y);
      frame.setPosition(topLeft.x, topLeft.y);
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

  syncSelectionFrames() {
    for (let index = 0; index < this.baseTileFrames.length; index += 1) {
      const isSelected = this.selectedIndex === index;
      this.baseTileFrames[index].setStrokeStyle(2, isSelected ? 0xf2f3f6 : 0x293242);
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
      .setDepth(10)
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
      this.tweenPromise({ targets: spriteA, x: targetA.x, y: targetA.y, ease: "Sine.easeInOut", duration: INVALID_OUT_MS }),
      this.tweenPromise({ targets: spriteB, x: targetB.x, y: targetB.y, ease: "Sine.easeInOut", duration: INVALID_OUT_MS }),
    ]);

    const originA = this.cellCenter(indexA);
    const originB = this.cellCenter(indexB);

    await Promise.all([
      this.tweenPromise({ targets: spriteA, x: originA.x, y: originA.y, ease: "Sine.easeInOut", duration: INVALID_BACK_MS }),
      this.tweenPromise({ targets: spriteB, x: originB.x, y: originB.y, ease: "Sine.easeInOut", duration: INVALID_BACK_MS }),
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
      this.tweenPromise({ targets: spriteA, x: targetA.x, y: targetA.y, ease: "Sine.easeInOut", duration: SWAP_MS }),
      this.tweenPromise({ targets: spriteB, x: targetB.x, y: targetB.y, ease: "Sine.easeInOut", duration: SWAP_MS }),
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

  async animateCascadeStep(cascade) {
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
            scaleX: 0.75,
            scaleY: 0.75,
            ease: "Sine.easeInOut",
            duration: CLEAR_MS,
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

    const rowTime = cascade.drops.length > 40 ? FALL_PER_ROW_MS_HEAVY : FALL_PER_ROW_MS;
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
          const duration = Math.min(FALL_MAX_MS, FALL_BASE_MS + rows * rowTime);
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
        .setDepth(10)
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
            duration: SPAWN_MS,
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
        duration: 90,
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
        duration: 110,
      });
    }
  }

  async animateResolvedSwap(resolved) {
    await this.animateSwapCommit(resolved.indexA, resolved.indexB);

    for (const cascade of resolved.cascades) {
      await this.animateCascadeStep(cascade);
      await this.sleep(CASCADE_GAP_MS);
    }

    if (resolved.reshuffled) {
      await this.animateReshuffle(resolved.boardAfter);
    }

    this.setViewBoard(resolved.boardAfter);
  }

  lockBoardInput() {
    this.isAnimatingBoard = true;
  }

  unlockBoardInput() {
    this.isAnimatingBoard = false;
    if (this.pendingResize) {
      this.pendingResize = false;
      this.layoutBoard();
      this.layoutPanels();
      this.refreshHud();
    }
  }

  async onCastSpell() {
    if (this.isAnimatingBoard) {
      return;
    }

    const spellId = this.engine.state.player.spells[0];
    const result = this.engine.playerCastSpell(spellId);
    if (!result.ok) {
      this.engine.state.statusText = `Spell failed: ${result.reason}`;
    }
    this.refreshHud();
  }

  onSkipSpell() {
    if (this.isAnimatingBoard) {
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
    if (this.isAnimatingBoard) {
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
    const identical = original.boardHash === replay.boardHash && original.enemy.hp === replay.enemy.hp && original.player.hp === replay.player.hp;

    this.engine.state.statusText = identical
      ? "Replay verification passed (deterministic)."
      : "Replay mismatch detected.";
    this.refreshHud();
  }

  onToggleDebug() {
    this.debugVisible = !this.debugVisible;
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

    this.createEngine(classId);
    this.engine.state.statusText = `Started new run as ${classId}.`;
    this.initBoardSprites();
    this.refreshHud();
  }

  async onTileTap(index) {
    if (this.isAnimatingBoard || this.engine.state.gameOver) {
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

      this.refreshHud();
      return;
    }

    this.lockBoardInput();
    await this.animateResolvedSwap(result);
    this.refreshHud();

    if (!this.engine.state.gameOver && this.engine.state.turnOwner === "enemy") {
      const enemyTurn = this.engine.processEnemyTurn();
      if (enemyTurn?.didMove && enemyTurn.resolved?.ok) {
        await this.animateResolvedSwap(enemyTurn.resolved);
      }
    }

    this.unlockBoardInput();
    this.engine.state.statusText = `Swap resolved: ${result.cascades.length} cascades.`;
    this.refreshHud();
  }

  refreshHud() {
    const snapshot = this.engine.getDebugSnapshot();

    this.statusText.setText(this.engine.state.statusText || "Spell -> Swap -> Resolve -> Enemy");
    this.turnText.setText(`Turn: ${snapshot.turnOwner.toUpperCase()} (${snapshot.turnPhase}) | Class: ${this.currentClass}`);

    this.playerPanel.setText(
      `Player ${snapshot.player.name}\nHP ${shortNum(snapshot.player.hp)}/${shortNum(snapshot.player.maxHp)}  Mana ${shortNum(snapshot.player.mana)}  Armor ${shortNum(snapshot.player.armor)}\nSkill ${shortNum(snapshot.player.skillCharge)}  Gold ${shortNum(snapshot.player.gold)}  Cooldowns ${JSON.stringify(snapshot.player.cooldowns)}`,
    );

    this.enemyPanel.setText(
      `Enemy ${snapshot.enemy.name}\nHP ${shortNum(snapshot.enemy.hp)}/${shortNum(snapshot.enemy.maxHp)}  Mana ${shortNum(snapshot.enemy.mana)}  Armor ${shortNum(snapshot.enemy.armor)}\nEffects ${JSON.stringify(snapshot.enemy.effects)}`,
    );

    const events = this.engine.state.logger.getEvents();
    const readable = events
      .slice(-10)
      .map((event) => `${event.index}. ${event.type}`)
      .join("\n");

    this.combatLogText.setText(`Combat Log\n${readable}`);

    this.debugPanel.setVisible(this.debugVisible);
    if (this.debugVisible) {
      this.debugText.setText(
        [
          `DEBUG OVERLAY (D to toggle)`,
          `seed=${snapshot.seed}`,
          `boardHash=${snapshot.boardHash}`,
          `turnOwner=${snapshot.turnOwner}`,
          `phase=${snapshot.turnPhase}`,
          `cascade=${snapshot.cascadeLevel} x${snapshot.cascadeMultiplier}`,
          `delta=${JSON.stringify(snapshot.resourceDelta)}`,
          `lastMove=${snapshot.lastMove}`,
          `logLevel=${this.logLevels[this.logLevelIndex]}`,
          `animating=${this.isAnimatingBoard}`,
        ].join("\n"),
      );
    }

    if (this.engine.state.gameOver) {
      this.summaryText.setText(
        [
          "Game Over",
          `Enemies defeated: ${this.engine.state.metrics.enemiesDefeated}`,
          `Damage dealt: ${this.engine.state.metrics.totalDamageDealt}`,
          `Damage taken: ${this.engine.state.metrics.totalDamageTaken}`,
        ].join("\n"),
      );
    } else {
      this.summaryText.setText(
        [
          "Run Summary",
          `Enemies defeated: ${this.engine.state.metrics.enemiesDefeated}`,
          `Damage dealt: ${this.engine.state.metrics.totalDamageDealt}`,
          `Damage taken: ${this.engine.state.metrics.totalDamageTaken}`,
        ].join("\n"),
      );
    }
  }
}
