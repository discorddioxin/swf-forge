package com.gaiaonline.games.gPinball
{
   import com.custom.KeyCheck;
   import com.gaiaonline.games.gPinball.compound_elements.Bumper;
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   import com.gaiaonline.games.gPinball.compound_elements.KickBumper;
   import com.gaiaonline.games.gPinball.compound_elements.RampBank;
   import com.gaiaonline.games.gPinball.compound_elements.RampBankKickBack;
   import com.gaiaonline.games.gPinball.compound_elements.RampBoutique;
   import com.gaiaonline.games.gPinball.compound_elements.RampGoldMountain;
   import com.gaiaonline.games.gPinball.compound_elements.RampGuild;
   import com.gaiaonline.games.gPinball.compound_elements.RampHelson;
   import com.gaiaonline.games.gPinball.compound_elements.RampMarket;
   import com.gaiaonline.games.gPinball.compound_elements.RampMarketKickBack;
   import com.gaiaonline.games.gPinball.compound_elements.Saucer;
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   import com.gaiaonline.games.gPinball.compound_elements.TargetPickup;
   import com.gaiaonline.games.gPinball.compound_elements.ToggleGroup;
   import com.gaiaonline.games.gPinball.igmd.IGMDMessage;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.system.System;
   import flash.utils.*;
   
   public class PinballTable extends MovieClip
   {
      
      public static var __Session:int = 0;
      
      public var coinLights:MovieClip;
      
      public var boutiqueramp_art:MovieClip;
      
      public var kittyBumper:Bumper;
      
      public var guildramp_entry_fg:MovieClip;
      
      public var orbit:MovieClip;
      
      public var plungekey:Number;
      
      public var helsonSaucerExit:Saucer;
      
      public var bankramp:RampBank;
      
      public var boutiqueramp_entry_fg:MovieClip;
      
      public var zurgTarget:TargetGroup;
      
      public var grunnyTargets:TargetGroup;
      
      public var kicker_ra:KickBumper;
      
      public var kicker_rc:KickBumper;
      
      public var rockpuppyTarget:TargetGroup;
      
      public var gambinoSaucer:Saucer;
      
      public var __NudgeHold:int = 30;
      
      public var multiballStart:Boolean;
      
      public var fmLight:MovieClip;
      
      public var mkbramp:RampMarketKickBack;
      
      public var __DefaultNudgeKey:int = 32;
      
      public var section_ht:Number;
      
      private var __ClearHold:Boolean;
      
      public var safetySwitch:MovieClip;
      
      public var __NudgePower:Number;
      
      public var popup:MovieClip;
      
      public var __NudgeCount:int;
      
      public var bot2Target:TargetGroup;
      
      public var gaiaLight:MovieClip;
      
      public var total_sections:Number;
      
      public var bkbramp:RampBankKickBack;
      
      public var boutiqueramp_fg_art:MovieClip;
      
      public var casaGambino:MovieClip;
      
      public var loganSaucer:Saucer;
      
      public var eventlight_gmramp:MovieClip;
      
      public var guildramp_fg_art:MovieClip;
      
      public var fishBumper:Bumper;
      
      private var leftflipkey:Number;
      
      public var eventlight_guildramp:MovieClip;
      
      private var score_xml_loaded:Boolean;
      
      public var gift1:TargetPickup;
      
      public var gift4:TargetPickup;
      
      public var gift5:TargetPickup;
      
      public var gift6:TargetPickup;
      
      public var gift7:TargetPickup;
      
      public var gift8:TargetPickup;
      
      public var slotsTargets:TargetGroup;
      
      public var eventlight_orbit:MovieClip;
      
      public var gift3:TargetPickup;
      
      public var gift9:TargetPickup;
      
      public var gift2:TargetPickup;
      
      public var helsonSaucer:Saucer;
      
      public var jets:MovieClip;
      
      public var __MaxMultiBalls:int = 3;
      
      public var skilleject:MovieClip;
      
      public var surfaceLights:MovieClip;
      
      public var sparks:MovieClip;
      
      private var rightflipkey:Number;
      
      public var __DefaultPlungerKey:int = 40;
      
      public var __DefaultRightFlipperKey:int = 191;
      
      public var helsonMansion:ToggleGroup;
      
      public var __BallsInPlay:int;
      
      public var l_flipper_l:Flipper;
      
      public var boutiqueramp:RampBoutique;
      
      public var l_flipper_c:Flipper;
      
      public var bot1Target:TargetGroup;
      
      public var __Player1:PlayerObject;
      
      public var plungercover:MovieClip;
      
      public var marketLights:MovieClip;
      
      public var gmramp_entry_bg:MovieClip;
      
      public var l_flipper_r:Flipper;
      
      public var goldSpinner:MovieClip;
      
      public var guildramp_art:MovieClip;
      
      public var cur_player:PlayerObject;
      
      public var copterblades:MovieClip;
      
      private var tableinit:Boolean;
      
      public var r_flipper_c:Flipper;
      
      public var TablePickups:Array;
      
      public var __NudgeTiltReduceTime:int = 1000;
      
      public var sin90:Number;
      
      public var r_flipper_l:Flipper;
      
      public var r_flipper_r:Flipper;
      
      public var gmramp:RampGoldMountain;
      
      public var __NudgeKeyDown:Boolean;
      
      public var gmramp_fg_art:MovieClip;
      
      public var gmramp_entry_fg:MovieClip;
      
      public var ball5:Ball;
      
      public var ball3:Ball;
      
      public var ball4:Ball;
      
      public var x_divide:Number;
      
      public var ball2:Ball;
      
      public var lights:MovieClip;
      
      public var eventlight_boutiqueramp:MovieClip;
      
      public var ball1:Ball;
      
      public var spinner:MovieClip;
      
      public var Balls:Array;
      
      public var __Gravity:vector2d;
      
      public var marketramp:RampMarket;
      
      public var __DefaultNudgeLEFT:int = 0;
      
      public var rightramp_art_top:MovieClip;
      
      public var eventlight_rightramp:MovieClip;
      
      public var casinoLights:MovieClip;
      
      public var __NudgeTilt:int = 5;
      
      public var guildramp:RampGuild;
      
      public var lockeject:MovieClip;
      
      public var __NudgeTime:int = 100;
      
      public var boutiqueLights:MovieClip;
      
      public var __DefaultInventoryLEFT:int = 37;
      
      public var mcBLights:MovieClip;
      
      public var helsonramp:RampHelson;
      
      public var __DefaultLeftFlipperKey:int = 90;
      
      public var multiball:Boolean;
      
      public var voteTargets:TargetGroup;
      
      public var __DefaultInventoryRIGHT:int = 39;
      
      public var safety:MovieClip;
      
      public var rightramp_art:MovieClip;
      
      public var helsonDoorway:MovieClip;
      
      public var __DefaultNudgeRIGHT:int = 0;
      
      public var cos90:Number;
      
      public var extraball_light:MovieClip;
      
      public var kicker_ea:KickBumper;
      
      public var __ActiveBalls:int;
      
      public var gambinoTargets:TargetGroup;
      
      public var cowTarget:TargetGroup;
      
      public var tradeTargets:TargetGroup;
      
      public var goldMountain:MovieClip;
      
      public var characters1:MovieClip;
      
      public var __TableBalls:int = 5;
      
      public var arenaBumper1:Bumper;
      
      public var arenaBumper0:Bumper;
      
      public var arenaBumper2:Bumper;
      
      public var __Nudging:Boolean;
      
      public var __NudgeKey:Number;
      
      public var aniMessages:MovieClip;
      
      public var gift10:TargetPickup;
      
      public var __MaxBalls:int = 5;
      
      public var gift13:TargetPickup;
      
      public var gift14:TargetPickup;
      
      public var gift15:TargetPickup;
      
      public var gift11:TargetPickup;
      
      public var gift12:TargetPickup;
      
      public var guildTarget:TargetGroup;
      
      public var __DefaultInventoryUSE:int = 38;
      
      public var bankLights:MovieClip;
      
      public var ballspot:MovieClip;
      
      public var fishTargets:TargetGroup;
      
      public var nolose_center1:Obstacle;
      
      public var nolose_center2:Obstacle;
      
      public var gambinoLights:MovieClip;
      
      public var scoreboard:PinballScoreBoard;
      
      public var gmramp_art:MovieClip;
      
      public var eventlight_spinner:MovieClip;
      
      public var guildramp_entry_bg:MovieClip;
      
      public var __NudgeTiltTimer:Timer;
      
      public var launchLights:MovieClip;
      
      public var jet_art:MovieClip;
      
      public var kicker_la:KickBumper;
      
      public var kicker_lc:KickBumper;
      
      public var boutiqueramp_entry_bg:MovieClip;
      
      public var walls:MovieClip;
      
      public var default_obst_decay:Number = 0.4;
      
      public var guildLights:MovieClip;
      
      public var cur_player_id:Number;
      
      public function PinballTable()
      {
         super();
      }
      
      public function endMultiball() : void
      {
         dTrace("endMultiball");
         multiball = false;
      }
      
      public function ClearMem() : void
      {
         dTrace("ClearMem was CALLED  Should Happaen only once");
         if(scoreboard.IGMD_MASTER.running)
         {
            scoreboard.IGMD_MASTER.transitionAbort();
         }
         resumeClear();
      }
      
      public function startMultiball() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Ball = null;
         var _loc3_:* = 0;
         dTrace("multiball startMultiball");
         multiballStart = true;
         multiball = true;
         if(__BallsInPlay < 3)
         {
            dTrace("multiball spawning more balls");
            _loc3_ = 1;
            _loc1_ = 1;
            while(_loc1_ <= __MaxMultiBalls)
            {
               _loc2_ = this["ball" + _loc1_];
               dTrace("multiball checking ball " + _loc2_.name + " (inplay: " + _loc2_.__Inplay + ")");
               if(!_loc2_.__Inplay)
               {
                  dTrace("multiball launching " + _loc2_.name);
                  _loc2_.initBall(false,true,1000 * _loc3_++);
               }
               _loc1_++;
            }
         }
      }
      
      public function controlRampGate(param1:Array) : void
      {
         var _loc2_:Trigger = null;
         var _loc3_:MovieClip = null;
         _loc2_ = this[param1[0]].enter_ramp;
         _loc3_ = this[param1[0]].gateArt;
         switch(param1[1])
         {
            case "close":
               if(_loc2_.active)
               {
                  _loc2_.setActive(false);
                  _loc3_.gotoAndPlay("CLOSEGATE");
               }
               break;
            case "open":
               if(!_loc2_.active)
               {
                  _loc2_.setActive(true);
                  _loc3_.gotoAndPlay("OPENGATE");
               }
         }
      }
      
      private function resetTargets() : void
      {
         resetTableLighting();
         respawnGifts();
         resetHelsonMode();
         guildramp.guildSpinner.stopSpinner();
         guildramp.guildSpinner.endEvent();
         guildLights.gotoAndStop("OFF");
         controlRampGate(["gmramp","close"]);
         controlRampGate(["bankramp","close"]);
         controlRampGate(["marketramp","close"]);
         controlRampGate(["bkbramp","close"]);
         controlRampGate(["mkbramp","close"]);
         guildramp.multiballTrigger.setActive(false);
         if(kittyBumper != null)
         {
            kittyBumper.resetAll();
         }
         grunnyTargets.resetAll();
         guildTarget.resetAll();
         tradeTargets.resetAll();
         voteTargets.resetAll();
         arenaBumper0.resetAll();
         arenaBumper1.resetAll();
         arenaBumper2.resetAll();
         slotsTargets.resetAll();
         gambinoTargets.resetAll();
         fishTargets.resetAll();
         fishBumper.resetAll();
         rockpuppyTarget.resetAll();
         zurgTarget.resetAll();
         boutiqueLights.gotoAndStop("OFF");
         fmLight.gotoAndStop(1);
         casaGambino.gotoAndStop(1);
         coinLights.gotoAndStop(1);
         bot1Target.gotoAndStop(1);
         bot2Target.gotoAndStop(1);
         cowTarget.gotoAndStop(1);
         zurgTarget.gotoAndStop(1);
         rockpuppyTarget.gotoAndStop(1);
      }
      
      public function initTable() : void
      {
         var _loc1_:DisplayObject = null;
         var _loc2_:int = 0;
         resetAllLights();
         _loc2_ = 0;
         while(_loc2_ < numChildren)
         {
            _loc1_ = getChildAt(_loc2_);
            if(_loc1_ is Obstacle)
            {
               (_loc1_ as Obstacle).init(default_obst_decay,0,"table",null,0);
            }
            _loc2_++;
         }
         nolose_center1.__Active = false;
         nolose_center2.__Active = false;
         stage.removeEventListener(KeyboardEvent.KEY_DOWN,nudge);
         stage.addEventListener(KeyboardEvent.KEY_DOWN,nudge,false,0,true);
         setKeys(__DefaultLeftFlipperKey,__DefaultRightFlipperKey,__DefaultNudgeKey,__DefaultPlungerKey);
         manageDepths();
         if(guildramp_art != null)
         {
            guildramp_art.alpha = 0.3;
         }
         if(boutiqueramp_art != null)
         {
            boutiqueramp_art.alpha = 0.3;
         }
         if(gmramp_art != null)
         {
            gmramp_art.alpha = 0.3;
         }
         __NudgeCount = 0;
         __NudgeTiltTimer = new Timer(__NudgeTiltReduceTime,0);
         __NudgeTiltTimer.addEventListener("timer",reduceNudgeCount,false,0,true);
      }
      
      public function init() : void
      {
         var _loc1_:int = 0;
         ++__Session;
         Balls = new Array();
         TablePickups = new Array();
         section_ht = 70;
         total_sections = 14;
         x_divide = 225;
         __NudgePower = 2;
         multiball = false;
         multiballStart = false;
         _loc1_ = 1;
         while(_loc1_ <= total_sections)
         {
            this["sec" + _loc1_].visible = false;
            this["obstacles" + _loc1_] = new Array();
            this["triggers" + _loc1_] = new Array();
            this["brakes" + _loc1_] = new Array();
            _loc1_++;
         }
         setGravity(0.25);
         sin90 = Math.sin(NumberTools.toRadians(-90));
         cos90 = Math.cos(NumberTools.toRadians(-90));
         ballspot.visible = false;
         checkLoad();
      }
      
      public function nudge(param1:Event) : void
      {
         var _loc2_:Timer = null;
         var _loc3_:Timer = null;
         if(PinballCore.__KeyboardIO)
         {
            if(KeyCheck.isDown(__NudgeKey))
            {
               if(!__Nudging && !__NudgeKeyDown && __NudgeCount < 5)
               {
                  ++__NudgeCount;
                  y -= __NudgePower;
                  __Nudging = true;
                  __NudgeKeyDown = true;
                  if(!__NudgeTiltTimer.running)
                  {
                     __NudgeTiltTimer.start();
                  }
                  _loc2_ = new Timer(__NudgeTime,1);
                  _loc2_.addEventListener("timer",endNudge,false,0,true);
                  _loc2_.start();
                  _loc3_ = new Timer(__NudgeHold,1);
                  _loc3_.addEventListener("timer",releaseNudge,false,0,true);
                  _loc3_.start();
               }
            }
         }
      }
      
      public function respawnGifts() : void
      {
         gift1.reset();
         gift2.reset();
         gift3.reset();
         gift4.reset();
         gift5.reset();
         gift6.reset();
         gift7.reset();
         gift8.reset();
         gift9.reset();
         gift10.reset();
         gift11.reset();
         gift12.reset();
         gift13.reset();
         gift14.reset();
         gift15.reset();
      }
      
      public function endNudge(param1:TimerEvent) : void
      {
         var _loc2_:Timer = null;
         __Nudging = false;
         _loc2_ = param1.target as Timer;
         if(_loc2_.running)
         {
            _loc2_.stop();
         }
         y += __NudgePower;
      }
      
      public function reset(param1:Boolean) : void
      {
         if(param1)
         {
            cur_player.reset();
         }
         scoreboard.__IGMDQueue = new Array();
         if(scoreboard.IGMD_MASTER.running)
         {
            dTrace("IGMD_MASTER was running");
            scoreboard.__CurrentMessage = null;
            scoreboard.IGMD_MASTER.transitionAbort();
         }
         multiball = false;
         multiballStart = false;
         resetAllLights();
         resetTargets();
         nolose_center1.__Active = false;
         nolose_center2.__Active = false;
         stage.removeEventListener(KeyboardEvent.KEY_DOWN,nudge);
         stage.addEventListener(KeyboardEvent.KEY_DOWN,nudge,false,0,true);
         setKeys(__DefaultLeftFlipperKey,__DefaultRightFlipperKey,__DefaultNudgeKey,__DefaultPlungerKey);
         manageDepths();
         if(guildramp_art != null)
         {
            guildramp_art.alpha = 0.3;
         }
         if(boutiqueramp_art != null)
         {
            boutiqueramp_art.alpha = 0.3;
         }
         if(gmramp_art != null)
         {
            gmramp_art.alpha = 0.3;
         }
         __NudgeCount = 0;
         if(!__NudgeTiltTimer)
         {
            __NudgeTiltTimer = new Timer(__NudgeTiltReduceTime,0);
            __NudgeTiltTimer.addEventListener("timer",reduceNudgeCount,false,0,true);
         }
      }
      
      public function releaseNudge(param1:TimerEvent) : void
      {
         var _loc2_:Timer = null;
         __NudgeKeyDown = false;
         _loc2_ = param1.target as Timer;
         if(!KeyCheck.isDown(__NudgeKey))
         {
            if(_loc2_.running)
            {
               _loc2_.stop();
            }
         }
      }
      
      public function setKeys(param1:int, param2:int, param3:int, param4:int) : void
      {
         if(l_flipper_l != null)
         {
            l_flipper_l.init(param1);
         }
         if(l_flipper_r != null)
         {
            l_flipper_r.init(param1);
         }
         if(r_flipper_r != null)
         {
            r_flipper_r.init(param2);
         }
         if(l_flipper_c != null)
         {
            l_flipper_c.init(param1);
         }
         if(r_flipper_c != null)
         {
            r_flipper_c.init(param2);
         }
         leftflipkey = param1;
         rightflipkey = param2;
         __NudgeKey = param3;
         plungekey = param4;
      }
      
      public function startPlayer() : void
      {
         cur_player.newBall(false);
      }
      
      public function completeInit() : void
      {
         if(score_xml_loaded && !tableinit)
         {
            tableinit = true;
            gotoAndPlay("INIT");
         }
      }
      
      public function nextTurn() : void
      {
         if(cur_player.__GameIsOver)
         {
            gameOver();
            return;
         }
         scoreboard.showMessage(new IGMDMessage("startball"));
      }
      
      public function resumeClear() : void
      {
         var _loc1_:String = null;
         var _loc2_:MovieClip = null;
         setContinue(null);
         cur_player = null;
         __Player1 = null;
         dTrace("Starting table element Iterator. (" + System.totalMemory / 1024 / 1000 + "MB)");
         while(this.numChildren > 0)
         {
            _loc2_ = this.getChildAt(0) as MovieClip;
            dTrace("Setting " + _loc2_ + "(" + _loc2_.name + ") to null.");
            if(_loc2_.ClearMem)
            {
               __ClearHold = true;
               _loc2_.addEventListener("doneClearMem",setContinue);
               _loc2_.ClearMem();
               while(__ClearHold)
               {
               }
            }
            this.removeChild(_loc2_);
            _loc2_ = null;
         }
         dTrace("Continuing table element Iterator. (" + System.totalMemory / 1024 / 1000 + "MB)");
         for(_loc1_ in this)
         {
            dTrace("Setting " + _loc1_ + " to null.");
            this[_loc1_] = null;
         }
         dTrace("Finished table element Iterator. (" + System.totalMemory / 1024 / 1000 + "MB)");
         PinballCore.__Root.resumeNewGame();
      }
      
      public function checkLoad() : void
      {
         score_xml_loaded = true;
         completeInit();
      }
      
      public function get gravity() : vector2d
      {
         return __Gravity;
      }
      
      public function onReveal() : void
      {
         scoreboard.newGameClick();
      }
      
      public function resetAllLights() : void
      {
         casinoLights.gotoAndStop("OFF");
         guildLights.gotoAndStop("OFF");
         gambinoLights.gotoAndStop("OFF");
         bankLights.gotoAndStop("OFF");
         marketLights.gotoAndStop("OFF");
         boutiqueLights.gotoAndStop("OFF");
      }
      
      public function reduceNudgeCount(param1:TimerEvent) : void
      {
         if(__NudgeCount > 0)
         {
            --__NudgeCount;
         }
         if(__NudgeCount == 0)
         {
            (param1.target as Timer).reset();
         }
      }
      
      public function resetHelsonMode() : void
      {
         helsonramp.hBall.setActive(false);
         gaiaLight.gotoAndStop(1);
         gambinoTargets.resetAll();
         helsonramp.helsonTargets.resetLevel();
         mcBLights.visible = true;
         helsonramp.setActive(false);
         helsonramp.activeBall = null;
         helsonMansion.deactivate(false);
         helsonDoorway.gotoAndStop(1);
      }
      
      private function setContinue(param1:Event) : void
      {
         __ClearHold = false;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[PinballTable]",param1);
      }
      
      public function startGame() : void
      {
         scoreboard.new_game = false;
         if(!cur_player)
         {
            cur_player = new PlayerObject(1,PinballCore.__Root.score_xml);
         }
         __Nudging = false;
         __BallsInPlay = 0;
         scoreboard.showMessage(new IGMDMessage("startball"));
      }
      
      public function endAllEvents() : void
      {
      }
      
      public function setGravity(param1:Number) : void
      {
         __Gravity = new vector2d(0,param1);
      }
      
      public function manageDepths() : void
      {
      }
      
      public function gameOver() : void
      {
         dTrace("gameOver");
      }
      
      public function resetTableLighting() : void
      {
         mcBLights.sLightGuild.switchOff();
         mcBLights.sLightMarket.switchOff();
         mcBLights.sLightBank.switchOff();
         mcBLights.sLightGambino.switchOff();
         mcBLights.sLightCasino.switchOff();
         mcBLights.sLightLogan.switchOff();
         mcBLights.sLightBoutique.switchOff();
         mcBLights.visible = true;
         surfaceLights.fish.switchOff();
         surfaceLights.grunny.switchOff();
         surfaceLights.gambino.switchOff();
         surfaceLights.zurg.switchOff();
      }
   }
}

