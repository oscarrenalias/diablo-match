import Phaser from "phaser";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../game/constants.js";
import { createGameEngine } from "../game/engine.js";
import { BoardEffects } from "../ui/BoardEffects.js";
import { CombatHUD } from "../ui/CombatHUD.js";

const TILE_SIZE = 64;
const TILE_GAP = 4;

const DEPTH_BOARD = 10;
const DEPTH_BOARD_FRAME = 12;
const DEPTH_OVERLAY = 14;
const DEPTH_EFFECTS = 22;
const DEPTH_HUD = 30;
const DEPTH_DEV_PANEL = 60;

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

function capWord(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    this.viewBoard = [];

    this.isAnimatingBoard = false;
    this.pendingResize = false;

    this.lastProcessedEventIndex = 0;
    this.activeEnemyId = null;

    this.devPanelVisible = true;
  }

  preload() {
    this.load.atlas(
      "tiles-atlas",
      "/assets/generated/tiles-atlas.png",
      "/assets/generated/tiles-atlas.json",
    );

    this.load.atlas(
      "ui-portraits-atlas",
      "/assets/generated/atlas/ui-portraits-atlas.png",
      "/assets/generated/atlas/ui-portraits-atlas.json",
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
    this.processNewEngineEvents();
    this.refreshHud();

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
        .setDepth(DEPTH_BOARD)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => this.onTileTap(index));

      const frame = this.add
        .rectangle(topLeft.x, topLeft.y, TILE_SIZE, TILE_SIZE)
        .setOrigin(0)
        .setFillStyle(0x000000, 0)
        .setStrokeStyle(2, 0x293242)
        .setDepth(DEPTH_BOARD_FRAME);

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

  logLineForMatch(match, boardBefore) {
    const tileType = boardBefore[match[0]];
    const tile = capWord(String(tileType ?? "tile"));
    return `${match.length}x ${tile} match`;
  }

  async animateCascadeStep(cascade) {
    if (cascade.multiplier > 1 && this.boardEffects) {
      this.boardEffects.showCombo(cascade.multiplier);
    }

    for (const match of cascade.matches) {
      this.hud?.pushCombatLog(this.logLineForMatch(match, cascade.boardBefore));
    }

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
      this.layoutHud();
      this.layoutDevPanel();
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
    } else {
      this.hud?.setHeroState("cast");
      this.hud?.pushCombatLog(`Cast ${spellId}`);
    }

    this.processNewEngineEvents();
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

      this.processNewEngineEvents();
      this.refreshHud();
      return;
    }

    this.lockBoardInput();
    await this.animateResolvedSwap(result);
    this.processNewEngineEvents();
    this.refreshHud();

    if (!this.engine.state.gameOver && this.engine.state.turnOwner === "enemy") {
      const enemyTurn = this.engine.processEnemyTurn();
      if (enemyTurn?.didMove && enemyTurn.resolved?.ok) {
        await this.animateResolvedSwap(enemyTurn.resolved);
      }

      this.processNewEngineEvents();
    }

    this.unlockBoardInput();
    this.engine.state.statusText = `Swap resolved: ${result.cascades.length} cascades.`;
    this.refreshHud();
  }

  processNewEngineEvents() {
    const events = this.engine.state.logger.getEvents();
    const startIndex = this.lastProcessedEventIndex;

    for (let i = startIndex; i < events.length; i += 1) {
      const event = events[i];
      const { type, payload } = event;

      if (type === "spell_cast" && payload.caster === this.engine.state.player.name) {
        this.hud?.setHeroState("cast");
        this.hud?.pushCombatLog(`Spell: ${payload.spellId}`);
      }

      if (type === "damage_application") {
        const dmg = payload.detail?.damage?.finalDamage ?? 0;
        if (dmg > 0) {
          const targetIsPlayer = payload.to === this.engine.state.player.name;
          this.boardEffects?.showDamage(dmg, targetIsPlayer ? "hero" : "enemy");
          this.hud?.pushCombatLog(`${payload.by} -> ${payload.to}: ${dmg} dmg`);

          if (targetIsPlayer) {
            this.hud?.setHeroState("hurt");
          }
        }
      }

      if (type === "resource_change") {
        const delta = payload.delta ?? {};
        if ((delta.gold ?? 0) > 0) {
          this.hud?.setHeroState("coin");
          this.hud?.pushCombatLog(`Gold +${delta.gold}`);
        }
      }

      if (type === "encounter_victory") {
        this.hud?.setHeroState("victory");
        this.hud?.pushCombatLog("Victory!");
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
    }

    this.lastProcessedEventIndex = events.length;
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

      this.hud.setTurnPhaseLabel(`${snapshot.turnOwner.toUpperCase()} - ${snapshot.turnPhase.toUpperCase()}`);

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
        `turn=${snapshot.turnOwner}/${snapshot.turnPhase} anim=${this.isAnimatingBoard}`,
        `boardHash=${snapshot.boardHash}`,
        `cascade=${snapshot.cascadeLevel} x${snapshot.cascadeMultiplier}`,
        `delta=${JSON.stringify(snapshot.resourceDelta)}`,
        `log=${this.logLevels[this.logLevelIndex]}`,
      ].join("\n"),
    );
  }
}
