package com.gaiaonline.games.gPinball
{
   import com.custom.KeyCheck;
   import com.gaiaonline.gameFramework.events.GaiaGameEvent;
   import com.gaiaonline.gameFramework.shell.IGameShell;
   import com.gaiaonline.gameFramework.sound.ISoundController;
   import com.gaiaonline.gameFramework.text.TextContentManager;
   import com.gaiaonline.gameFramework.ui.IShellUi;
   import com.gaiaonline.gameFramework.ui.IUserBar;
   import com.gaiaonline.games.IGaiaGame;
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   import com.gaiaonline.games.gPinball.compound_elements.Spinner;
   import com.gaiaonline.games.gPinball.igmd.IGMDMessage;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.InventoryItem;
   import com.gaiaonline.games.gPinball.uiscreens.uiEndGame;
   import com.gaiaonline.gateway.IGaiaGateway;
   import com.gaiaonline.gateway.events.GaiaFunctionEvent;
   import com.gaiaonline.gateway.events.GaiaFunctionResponseEvent;
   import fl.controls.TextArea;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.ContextMenuEvent;
   import flash.events.Event;
   import flash.events.FocusEvent;
   import flash.events.KeyboardEvent;
   import flash.events.TimerEvent;
   import flash.net.URLLoader;
   import flash.net.URLRequest;
   import flash.text.TextField;
   import flash.ui.ContextMenu;
   import flash.ui.ContextMenuBuiltInItems;
   import flash.ui.ContextMenuItem;
   import flash.utils.Timer;
   import flash.xml.XMLDocument;
   
   public dynamic class Pinball extends MovieClip implements IGaiaGame
   {
      
      private var size:uint = 100;
      
      private var black:uint = 0;
      
      public var __CoinLights:int;
      
      public var __SessionGold:int;
      
      public var __Magnatron:Boolean;
      
      public var __GameCount:int;
      
      public var userBar:IUserBar;
      
      public var __MaxInventory:int = 7;
      
      public var __MagnaDistance:Number = 40;
      
      public var __EndSlotEventSID:int;
      
      public var __CowTimer:Timer;
      
      private var red:uint = 16711680;
      
      public var revealclip:MovieClip;
      
      public var __MagnaStrength:Number = 1;
      
      private var xmlScoreString:URLRequest = new URLRequest("xml/scores.xml");
      
      public var __GoldMountainMultiplier:int;
      
      public var __ShortCut0:int;
      
      public var __ZurgSpawnCounter:int;
      
      private var menuLabel:String = "Pinball Version ";
      
      private var __Version:String = "080502";
      
      public var __MagnatronTimer:Timer;
      
      public var __Flippers:Array;
      
      public var shellUi:IShellUi;
      
      public var score_xml:XMLDocument;
      
      public var __UserName:String = "UserName";
      
      public var __GoldMountainPrize:int;
      
      public var __ServerScore:int = 0;
      
      public var __CheatsEnabled:Boolean = false;
      
      public var __HelsonExitSID:int;
      
      public var __HitQueue:Array;
      
      public var levelNum:uint;
      
      public var __DebugEnabled:Boolean = false;
      
      public var serverGateway:IGaiaGateway;
      
      public var __MyTable:PinballTable;
      
      public var __CharacterTimer:Timer;
      
      public var __RockpuppySpawnCounter:int;
      
      private var textLabel:String = "Right Click";
      
      public var __Demo:int = 5;
      
      public var __AvatarItems:Object;
      
      public var __Pause:Boolean;
      
      public var soundController:ISoundController;
      
      public var __Cheating:Boolean;
      
      public var spotBall1:MovieClip;
      
      public var spotBall2:MovieClip;
      
      public var spotBall3:MovieClip;
      
      public var __IgnoreGMLockSID:int = 4;
      
      public var __LevelUpGuildSID:int = 2;
      
      public var debug:TextArea;
      
      private var myContextMenu:ContextMenu;
      
      public var __XMLComplete:Boolean;
      
      public var __ZurgTimer:Timer;
      
      public var __RockpuppyTimer:Timer;
      
      public var score:uint;
      
      public var DefaultHeight:int = 450;
      
      public var __ShortcutSID:int;
      
      private var label:TextField;
      
      public var __MultiballSID:int;
      
      private var xmlLoader:URLLoader;
      
      public var __GuildTimer:Timer;
      
      public var __SafeBall:Boolean;
      
      public var mcFocusClip:MovieClip;
      
      public var __EndMultiballSID:int = 3;
      
      public var __MagnatronPauseTimer:Timer;
      
      public var __SafeBallTimer:Timer;
      
      public var __MaxBallVelocity:Number = 20;
      
      public var textContentManager:TextContentManager = TextContentManager.getInstance();
      
      public var __MagnatronPause:Boolean;
      
      public var mcDialogEG:uiEndGame;
      
      public var spotFlipper1:MovieClip;
      
      public var spotFlipper3:MovieClip;
      
      public var spotFlipper2:MovieClip;
      
      public var __EndGuildEventSID:int = 1;
      
      private var redRectangle:Sprite;
      
      public function Pinball()
      {
         addFrameScript(0,frame1,1,frame2);
         super();
         myContextMenu = new ContextMenu();
         removeDefaultItems();
         addCustomMenuItems();
         this.contextMenu = myContextMenu;
         PinballCore.keyboardInput(true);
         __GameCount = 0;
         __XMLComplete = false;
         __Cheating = false;
         __GuildTimer = new Timer(250,120);
         __MagnatronPauseTimer = new Timer(100,1);
         __MagnatronTimer = new Timer(500,60);
         __SafeBallTimer = new Timer(10000,1);
         __CharacterTimer = new Timer(500);
         __MagnatronTimer.addEventListener("timer",stopMagnatron,false,0,true);
         __CoinLights = 0;
         PinballCore.__Root = this;
         PinballCore.__EFM = new EnterFrameManager();
         __Magnatron = false;
         __MagnatronPause = false;
         __Flippers = new Array();
         __HitQueue = new Array();
         removeEventListener("addedToStage",initStage);
         addEventListener("addedToStage",initStage,false,0,true);
         this.focusRect = new Object();
         xmlLoader = new URLLoader(xmlScoreString);
         xmlLoader.removeEventListener("complete",doneScoreXML);
         xmlLoader.addEventListener("complete",doneScoreXML,false,0,true);
      }
      
      public function enterHelsonSaucer(param1:Ball, ... rest) : void
      {
         playSound("enterlock");
         __MyTable.cur_player.scoreIt("enterHelsonSaucer",0,__MyTable.helsonSaucer.__SID);
         doHelsonMode();
         dispatchQueue();
      }
      
      public function playSpark(param1:String) : void
      {
         var _loc2_:MovieClip = null;
         _loc2_ = __MyTable.sparks;
         if(_loc2_[param1])
         {
            _loc2_[param1].play();
         }
      }
      
      public function setZurgTime(param1:Object) : void
      {
         __ZurgSpawnCounter = param1.zurg;
      }
      
      public function zurgInvasion(param1:Event) : void
      {
         if(__MyTable.__BallsInPlay > 0)
         {
            __ZurgTimer.removeEventListener("timer",zurgInvasion);
            playSound("zurgintro");
            __MyTable.surfaceLights.zurg.switchOn();
            __MyTable.scoreboard.showMessage(new IGMDMessage("repelzurg"));
            __MyTable.zurgTarget.play();
         }
         else
         {
            __ZurgTimer.reset();
            __ZurgTimer.start();
         }
      }
      
      public function doPause() : void
      {
         __Pause = !__Pause;
         if(PinballCore.__EFM.__Active)
         {
            PinballCore.__EFM.stop();
         }
         else
         {
            PinballCore.__EFM.start();
         }
      }
      
      public function endMultiball(... rest) : void
      {
         if(__MyTable.multiball)
         {
            __MyTable.guildramp.multiballTrigger.setActive(false);
            if(__MyTable.tradeTargets.__GroupCount == 3)
            {
               __MyTable.tradeTargets.resetGroup();
            }
            __MyTable.endMultiball();
            __HitQueue.push(__EndMultiballSID);
            dispatchQueue();
         }
      }
      
      public function makeDebugger() : void
      {
         debug = new TextArea();
         addChild(debug);
         setChildIndex(debug,numChildren - 1);
         debug.visible = false;
         debug.x = 2;
         debug.y = 2;
         debug.width = 446;
         debug.height = 100;
         debug.editable = false;
      }
      
      public function onFunctionResponse(param1:GaiaFunctionResponseEvent) : void
      {
         var _loc2_:String = null;
         var _loc3_:* = undefined;
         if(param1.data.error == 0)
         {
            _loc2_ = param1.data.name;
            _loc3_ = param1.data.result;
            switch(_loc2_)
            {
               case "initGame":
                  dTrace("***RESPONSE initGame");
                  break;
               case "buyItem":
                  dTrace("***RESPONSE buyItem");
                  setPinballSIDs(_loc3_);
                  showBoughtItem();
                  break;
               case "useItem":
                  dTrace("***RESPONSE useItem");
                  break;
               case "saveData":
                  setPinballSIDs(_loc3_);
                  __ServerScore = _loc3_.__score;
                  if(Boolean(__MyTable) && Boolean(__DebugEnabled) && __ServerScore != __MyTable.cur_player.__CurrentScore)
                  {
                     debug.visible = true;
                     doPause();
                  }
                  break;
               case "endGame":
                  dTrace("***RESPONSE endGame response from server received");
            }
         }
         else
         {
            shellUi.createStandardDialogue("ALERT","Functionresponse Error:" + param1.data.error);
         }
         dTrace("Score: __ServerScore is " + __ServerScore + "" + (__ServerScore == __MyTable.cur_player.__CurrentScore ? "" : "   ***OUT OF SYNC"));
      }
      
      public function setRockpuppyTime(param1:Object) : void
      {
         __RockpuppySpawnCounter = param1.rockpuppy;
      }
      
      public function getSuccesMsg() : String
      {
         return "CONGRATULATIONS " + __UserName + "!";
      }
      
      private function onNewGameRequest(param1:Event) : void
      {
         if(userBar != null)
         {
            disableNewGameBtn();
         }
         EndGame();
      }
      
      public function disableNewGameBtn() : void
      {
         userBar.toggleNewGameButton(false);
      }
      
      public function enterRampBank(param1:Ball, ... rest) : void
      {
         param1.__Location = "bankramp";
      }
      
      public function setGoldSIDs(param1:Object) : void
      {
         __GoldMountainPrize = param1.prize;
      }
      
      public function startGuildEvent(... rest) : void
      {
         if(!__MyTable.guildramp.guildSpinner.__Event)
         {
            __MyTable.mcBLights.sLightGuild.switchOn();
            __MyTable.guildLights.gotoAndPlay("ON");
            __MyTable.scoreboard.showMessage(new IGMDMessage("tellguildbonus"));
            __MyTable.guildramp.guildSpinner.startEvent();
            __GuildTimer.removeEventListener("timer",countdownGuildEvent);
            __GuildTimer.addEventListener("timer",countdownGuildEvent,false,0,true);
            __GuildTimer.start();
            playSound("guildmusic");
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame2() : *
      {
         stop();
      }
      
      public function startMultiball(... rest) : void
      {
         dTrace("startMultiball - SID = " + __MultiballSID);
         __HitQueue.push(__MultiballSID);
         if(__MyTable.multiball)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("multiballJackpot"));
            __MyTable.cur_player.scoreIt("multiballJackpot",0);
         }
         else
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("multiball"));
            __MyTable.startMultiball();
            __MyTable.cur_player.scoreIt("multiballBonus",0);
         }
      }
      
      public function rockpuppyAppear(param1:Event) : void
      {
         if(__MyTable.__BallsInPlay > 0)
         {
            __RockpuppyTimer.removeEventListener("timer",rockpuppyAppear);
            __MyTable.scoreboard.showMessage(new IGMDMessage("rockpuppyappear"));
            __MyTable.rockpuppyTarget.play();
         }
         else
         {
            __RockpuppyTimer.reset();
            __RockpuppyTimer.start();
         }
      }
      
      public function killListeners() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         if(__GuildTimer != null)
         {
            if(__GuildTimer.hasEventListener("timer"))
            {
               __GuildTimer.removeEventListener("timer",countdownGuildEvent);
            }
            if(__GuildTimer.running)
            {
               __GuildTimer.stop();
            }
         }
         if(__ZurgTimer != null)
         {
            if(__ZurgTimer.hasEventListener("timer"))
            {
               __ZurgTimer.removeEventListener("timer",zurgInvasion);
            }
            if(__ZurgTimer.running)
            {
               __ZurgTimer.stop();
            }
         }
         if(__CowTimer != null)
         {
            if(__CowTimer.hasEventListener("timer"))
            {
               __CowTimer.removeEventListener("timer",cowInvasion);
            }
            if(__CowTimer.running)
            {
               __CowTimer.stop();
            }
         }
         if(__RockpuppyTimer != null)
         {
            if(__RockpuppyTimer.hasEventListener("timer"))
            {
               __RockpuppyTimer.removeEventListener("timer",rockpuppyAppear);
            }
            if(__RockpuppyTimer.running)
            {
               __RockpuppyTimer.stop();
            }
         }
         _loc1_ = 0;
         while(_loc1_ < __MyTable.scoreboard.inventory.numChildren)
         {
            _loc2_ = __MyTable.scoreboard.inventory.getChildAt(_loc1_);
            if(_loc2_ is InventoryItem)
            {
               (_loc2_ as InventoryItem).reset();
            }
            _loc1_++;
         }
      }
      
      public function setTable(param1:MovieClip) : void
      {
      }
      
      public function enterRampBoutique(param1:Ball, ... rest) : void
      {
         param1.__Location = "boutiqueramp";
         if(__MyTable.boutiqueramp_art != null)
         {
            __MyTable.boutiqueramp_art.alpha = 1;
         }
      }
      
      public function scoreRampGuild(param1:Ball, ... rest) : void
      {
         __MyTable.guildramp_art.alpha = 1;
         if(__MyTable.multiball)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("jackpot"));
            __MyTable.cur_player.scoreIt("multiball_jackpot",0);
         }
         else
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("multiball"));
            __MyTable.cur_player.scoreIt("guildramp",0);
         }
      }
      
      public function enterGambinoSaucer(param1:Ball, ... rest) : void
      {
         var _loc3_:int = 0;
         playSound("enterlock");
         __MyTable.surfaceLights.gambino.switchOff();
         __MyTable.gambinoLights.gotoAndStop("OFF");
         __MyTable.cur_player.scoreIt("enterGambinoSaucer",0,__MyTable.gambinoSaucer.__SID);
         __MyTable.gambinoTargets.closeBreakthrough();
         dispatchQueue();
         if(__MyTable.gambinoTargets.__GroupLevel == 1)
         {
            addCoin();
            __MyTable.scoreboard.showMessage(new IGMDMessage("gambinoLab"));
            __MyTable.mcBLights.sLightGambino.switchOff();
            playSound("destroy");
            __MyTable.controlRampGate(["bkbramp","open"]);
            __MyTable.casaGambino.gotoAndPlay("crumble");
            --__ZurgSpawnCounter;
            if(__ZurgSpawnCounter == 0)
            {
               _loc3_ = Math.floor(Math.random() * 30) + 1;
               __ZurgTimer = new Timer(_loc3_ * 1000,1);
               __ZurgTimer.removeEventListener("timer",zurgInvasion);
               __ZurgTimer.addEventListener("timer",zurgInvasion,false,0,true);
               __ZurgTimer.start();
            }
         }
         else if(__MyTable.gambinoTargets.__GroupLevel == 2)
         {
            addCoin();
            __MyTable.scoreboard.showMessage(new IGMDMessage("gambinoRebuild"));
            playSound("rebuild");
            __MyTable.controlRampGate(["mkbramp","open"]);
            __MyTable.casaGambino.gotoAndPlay("rebuild");
         }
         else
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("gambinoShootHelson"));
         }
      }
      
      public function enterBoutiqueSaucer(param1:Ball, ... rest) : void
      {
         __MyTable.mcBLights.sLightBoutique.switchOn();
         playSound("enterlock");
         __MyTable.cur_player.scoreIt("enterBoutiqueSaucer",0,__MyTable.boutiqueramp.boutiqueSaucer.__SID);
         playSound("enterboutique");
         dispatchQueue();
         if(serverGateway != null)
         {
            serverGateway.call("buyItem");
         }
         else
         {
            showBoughtItem();
         }
      }
      
      private function removeDefaultItems() : void
      {
         var _loc1_:ContextMenuBuiltInItems = null;
         myContextMenu.hideBuiltInItems();
         _loc1_ = myContextMenu.builtInItems;
         _loc1_.print = true;
      }
      
      internal function forceFocus(param1:Event) : void
      {
         stage.focus = this;
         PinballCore.keyboardInput(true);
      }
      
      public function controlRampGate(param1:Array) : void
      {
         __MyTable.controlRampGate(param1);
      }
      
      public function enterHelsonLaunch(param1:Ball, ... rest) : void
      {
      }
      
      public function dispatchQueue() : void
      {
         var _loc1_:int = 0;
         if(serverGateway != null)
         {
            serverGateway.call("saveData",__HitQueue);
            __HitQueue = null;
            __HitQueue = new Array();
         }
      }
      
      public function resumeNewGame() : void
      {
         var el:String = null;
         var ch:int = 0;
         if(__MyTable != null)
         {
            __MyTable.reset(true);
         }
         dTrace("WARNING! Table Iteration should only have happened once");
         for(el in this)
         {
            dTrace("el is " + this[el]);
         }
         ch = 0;
         while(ch < this.numChildren)
         {
            ch++;
         }
         if(mcDialogEG)
         {
            removeChild(mcDialogEG);
            mcDialogEG = null;
         }
         try
         {
         }
         catch(e:Error)
         {
            dTrace("Garbage Collection Failed");
         }
         dispatchEvent(new GaiaGameEvent(GaiaGameEvent.GAME_STARTED));
         if(__MyTable == null)
         {
            __MyTable = PinballCore.__Table = new mcPinballTable();
            addChild(__MyTable);
            setChildIndex(__MyTable,0);
            __MyTable.init();
         }
         __Pause = false;
         __ZurgSpawnCounter = -1;
         __RockpuppySpawnCounter = -1;
         if(serverGateway != null)
         {
            PinballCore.__Gateway = true;
            serverGateway.call("initGame");
         }
         else
         {
            PinballCore.__Gateway = false;
            testSetInventory();
            gameIsReady();
         }
      }
      
      public function exitRampBKB(param1:Ball, ... rest) : void
      {
         param1.__Location = "table";
         __MyTable.controlRampGate(["bkbramp","close"]);
      }
      
      public function testSetInventory() : void
      {
         var _loc1_:int = 0;
         var _loc2_:MovieClip = null;
         var _loc3_:InventoryItem = null;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:Object = null;
         var _loc7_:String = null;
         _loc2_ = __MyTable.scoreboard.inventory;
         _loc1_ = 1;
         while(_loc1_ <= __MaxInventory)
         {
            _loc3_ = _loc2_["inv" + _loc1_];
            _loc4_ = 0;
            _loc5_ = 1000;
            if(!_loc3_.__Active)
            {
               _loc3_.activate(_loc4_,_loc5_);
            }
            else
            {
               _loc3_.update(_loc4_,_loc5_);
            }
            _loc1_++;
         }
      }
      
      public function resetInventory() : void
      {
      }
      
      public function resetVote() : void
      {
         __MyTable.voteTargets.resetAll();
         __MyTable.arenaBumper0.resetAll();
         __MyTable.arenaBumper1.resetAll();
         __MyTable.arenaBumper2.resetAll();
      }
      
      public function enterHelsonExit(param1:Ball, ... rest) : void
      {
      }
      
      public function init(param1:IGameShell) : void
      {
         soundController = param1.soundController;
         serverGateway = param1.serverGateway;
         serverGateway.addEventListener(GaiaFunctionResponseEvent.FUNCTION_RESPONSE,onFunctionResponse,false,0,true);
         serverGateway.addEventListener(GaiaFunctionEvent.FUNCTION_CALL,onFunctionCall,false,0,true);
         shellUi = param1.shellUi;
         userBar = param1.userBar;
      }
      
      public function forceStopMagnatron(... rest) : void
      {
         var _loc2_:int = 0;
         var _loc3_:MovieClip = null;
         dTrace("Magnatron - ForceStop");
         if(__MagnatronTimer)
         {
            __MagnatronTimer.reset();
         }
         __MagnatronPause = false;
         __Magnatron = false;
         _loc2_ = 0;
         while(_loc2_ < __Flippers.length)
         {
            _loc3_ = __Flippers[_loc2_];
            _loc3_.gotoAndStop("NORMAL");
            _loc2_++;
         }
      }
      
      public function endSafeBall(param1:Event) : void
      {
         __MyTable.safety.deactivate(false);
         __SafeBall = false;
      }
      
      public function setFlippersIDs(param1:Object) : void
      {
         __MyTable.l_flipper_l.setSID(param1.flipper0);
         __MyTable.l_flipper_r.setSID(param1.flipper1);
         __MyTable.l_flipper_c.setSID(param1.flipper2);
         __MyTable.r_flipper_c.setSID(param1.flipper3);
         __MyTable.r_flipper_r.setSID(param1.flipper4);
         __MyTable.helsonramp.hFlipper_ll.setSID(param1.vflipper0);
         __MyTable.helsonramp.hFlipper_lc.setSID(param1.vflipper1);
         __MyTable.helsonramp.hFlipper_rc.setSID(param1.vflipper2);
         __MyTable.helsonramp.hFlipper_rr.setSID(param1.vflipper3);
         __MyTable.kicker_lc.setSID(param1.kicker0);
         __MyTable.kicker_la.setSID(param1.kicker1);
         __MyTable.kicker_rc.setSID(param1.kicker2);
         __MyTable.kicker_ra.setSID(param1.kicker3);
         __MyTable.bkbramp.BKBSaucer.setSID(param1.kickback1);
         __MyTable.mkbramp.MKBSaucer.setSID(param1.kickback2);
      }
      
      public function enableNewGameBtn() : void
      {
         userBar.toggleNewGameButton(true);
      }
      
      public function defaultFunction(... rest) : void
      {
      }
      
      public function useItem(param1:int) : void
      {
         if(serverGateway)
         {
            serverGateway.call("useItem",param1);
         }
      }
      
      public function resetGambino() : void
      {
         __MyTable.gambinoTargets.resetAll();
         __MyTable.casaGambino.gotoAndStop(1);
      }
      
      public function resetTrade() : void
      {
         __MyTable.tradeTargets.resetAll();
         __MyTable.controlRampGate(["bankramp","close"]);
         __MyTable.controlRampGate(["marketramp","close"]);
         __MyTable.guildramp.multiballTrigger.setActive(false);
      }
      
      public function enterBankSaucer(param1:Ball, ... rest) : void
      {
         __MyTable.mcBLights.sLightBank.switchOn();
         playSound("enterlock");
         playSound("bankintro");
         __MyTable.bankLights.gotoAndStop("OFF");
         __MyTable.cur_player.scoreIt("enterBankSaucer",0,__MyTable.bankramp.bankSaucer.__SID);
         __MyTable.scoreboard.showMessage(new IGMDMessage("banklock"));
         addCoin();
         dispatchQueue();
      }
      
      public function enterMarketSaucer(param1:Ball, ... rest) : void
      {
         __MyTable.mcBLights.sLightMarket.switchOn();
         playSound("enterlock");
         playSound("marketintro");
         __MyTable.marketLights.gotoAndStop("OFF");
         __MyTable.cur_player.scoreIt("enterMarketSaucer",0,__MyTable.marketramp.marketSaucer.__SID);
         __MyTable.scoreboard.showMessage(new IGMDMessage("marketlock"));
         addCoin();
         dispatchQueue();
      }
      
      public function doCowStartup(param1:Boolean) : void
      {
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         _loc2_ = param1 ? 0 : int(Math.floor(Math.random() * 5));
         _loc3_ = (Math.floor(Math.random() * 15) + 1) * 1000;
         if(__CowTimer == null)
         {
            __CowTimer = new Timer(_loc3_,1);
         }
         if(!__CowTimer.running)
         {
            __CowTimer.delay = _loc3_;
            __CowTimer.repeatCount = 1;
            if(!__CowTimer.hasEventListener("timer"))
            {
               switch(_loc2_)
               {
                  case 0:
                     __CowTimer.addEventListener("timer",cowInvasion,false,0,true);
                     __CowTimer.start();
                     break;
                  case 1:
                     __CowTimer.addEventListener("timer",bot1Invasion,false,0,true);
                     __CowTimer.start();
                     break;
                  case 2:
                     __CowTimer.addEventListener("timer",bot2Invasion,false,0,true);
                     __CowTimer.start();
               }
            }
         }
      }
      
      public function enterGoldMountainSaucer(param1:Ball, ... rest) : void
      {
         __MyTable.mcBLights.sLightCasino.switchOn();
         playSound("enterlock");
         __MyTable.casinoLights.gotoAndStop("OFF");
         __MyTable.cur_player.scoreIt("enterGoldMountain",0,__MyTable.gmramp.saucers.gmSaucer.__SID);
         playSound("entercasino");
         __MyTable.scoreboard.showMessage(new IGMDMessage("slotmachine"));
      }
      
      public function checkKeyDown(param1:KeyboardEvent) : void
      {
         var _loc2_:int = 0;
         if(param1.keyCode)
         {
            _loc2_ = int(param1.keyCode);
            if(PinballCore.__KeyboardIO)
            {
               switch(_loc2_)
               {
                  case 80:
                     if(__MyTable != null)
                     {
                        doPause();
                     }
               }
            }
         }
      }
      
      public function showBoughtItem(param1:int = -1) : void
      {
         var _loc2_:int = 0;
         var _loc3_:MovieClip = null;
         var _loc4_:MovieClip = null;
         var _loc5_:String = null;
         _loc2_ = __CoinLights;
         if(param1 >= 0 && param1 <= 7)
         {
            _loc2_ = param1;
         }
         _loc3_ = __MyTable.scoreboard.inventory;
         _loc4_ = _loc3_["inv" + _loc2_];
         if(_loc4_ != null && Boolean(_loc4_.__Active))
         {
            _loc5_ = _loc2_ + "pushed";
         }
         else
         {
            _loc5_ = _loc2_.toString();
         }
         if(_loc2_ > 0)
         {
            playSound("cashout");
         }
         else
         {
            playSound("powerupError");
         }
         dTrace("Telling IGMD to show message \'" + ("rufus_inv" + _loc5_) + "\'\'");
         __MyTable.scoreboard.showMessage(new IGMDMessage("rufus_inv" + _loc5_));
      }
      
      public function exitRampGoldMountain(param1:Ball, ... rest) : void
      {
         param1.__Location = "table";
         if(__MyTable.gmramp_art != null)
         {
            __MyTable.gmramp_art.alpha = 0.3;
         }
      }
      
      public function clearTable() : void
      {
      }
      
      public function zurgShotDown() : void
      {
         __MyTable.surfaceLights.zurg.switchOff();
         __MyTable.scoreboard.showMessage(new IGMDMessage("peaceisrestored"));
         dispatchQueue();
      }
      
      public function setGrunnySIDs(param1:Object) : void
      {
         __MyTable.grunnyTargets.target0.setSID(param1.grunny_target0);
         __MyTable.grunnyTargets.target1.setSID(param1.grunny_target1);
         __MyTable.grunnyTargets.target2.setSID(param1.grunny_target2);
      }
      
      public function startSafeBall(param1:Ball, ... rest) : void
      {
         doCowStartup(false);
         __MyTable.launchLights.gotoAndStop("OFF");
         if(!__MyTable.multiball && param1.__NewBall)
         {
            __MyTable.surfaceLights.grunny.switchOn();
            param1.__NewBall = false;
            __SafeBall = true;
            __MyTable.safety.activate();
            __SafeBallTimer.removeEventListener("timer",endSafeBall);
            __SafeBallTimer.addEventListener("timer",endSafeBall,false,0,true);
            __SafeBallTimer.start();
         }
         else
         {
            param1.__NewBall = false;
         }
      }
      
      public function enterBKBSaucer(param1:Ball, ... rest) : void
      {
         rest[0].eject(null);
      }
      
      public function newGame() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Flipper = null;
         dTrace("Calling newGame on serverGateway");
         stopMusic();
         playMusic("music2");
         if(!__Flippers)
         {
            __Flippers = new Array();
         }
         else
         {
            _loc1_ = 0;
            while(_loc1_ < __Flippers.length)
            {
               _loc2_ = __Flippers[_loc1_];
               _loc2_.setActive(true);
               _loc1_++;
            }
         }
         resumeNewGame();
      }
      
      public function EndEvents() : void
      {
         resetGuild();
         resetGrunny();
      }
      
      public function setGuildSIDs(param1:Object) : void
      {
         __MyTable.guildTarget.target0.setSID(param1.guild_target);
         __MyTable.guildramp.guildSpinner.setSID(param1.guild_spinner);
      }
      
      public function unPauseMagnatron(param1:Event) : void
      {
         dTrace("Magnatron - UnPause");
         if(__MagnatronPause)
         {
            __MagnatronPause = false;
            __Magnatron = true;
         }
         __MagnatronPauseTimer.reset();
      }
      
      public function doneScoreXML(param1:Event) : void
      {
         var _loc2_:XML = null;
         __XMLComplete = true;
         score_xml = new XMLDocument();
         score_xml.ignoreWhite = true;
         _loc2_ = XML(xmlLoader.data);
         score_xml.parseXML(_loc2_.toXMLString());
      }
      
      public function enterRampBKB(param1:Ball, ... rest) : void
      {
         param1.__Location = "bkbramp";
      }
      
      public function bot2Invasion(param1:Event) : void
      {
         __CowTimer.removeEventListener("timer",bot2Invasion);
         if(__MyTable.__BallsInPlay > 0)
         {
            __MyTable.bot2Target.play();
         }
         else
         {
            __CowTimer.reset();
            __CowTimer.start();
         }
      }
      
      public function exitRampBoutique(param1:Ball, ... rest) : void
      {
         param1.__Location = "table";
         if(__MyTable.boutiqueramp_art != null)
         {
            __MyTable.boutiqueramp_art.alpha = 0.3;
         }
      }
      
      public function resetBoutique() : void
      {
         __MyTable.boutiqueLights.gotoAndStop("OFF");
         __CoinLights = 0;
         __MyTable.coinLights.gotoAndStop(__CoinLights + 1);
      }
      
      public function startMagnatron() : void
      {
         var _loc1_:int = 0;
         var _loc2_:MovieClip = null;
         dTrace("Magnatron - Start Timer Listener");
         __MagnatronPause = false;
         __Magnatron = true;
         _loc1_ = 0;
         while(_loc1_ < __Flippers.length)
         {
            _loc2_ = __Flippers[_loc1_];
            _loc2_.gotoAndStop("STICKY");
            _loc1_++;
         }
         __MagnatronTimer.start();
      }
      
      public function onFunctionCall(param1:GaiaFunctionEvent) : void
      {
         var _loc2_:String = null;
         var _loc3_:* = undefined;
         _loc2_ = param1.data.name;
         _loc3_ = param1.data.args;
         switch(_loc2_)
         {
            case "dan":
               dTrace("***CALLED DAN!");
               break;
            case "initGame":
               dTrace("***CALLED initGame!");
               setPinballSIDs(_loc3_);
               __UserName = _loc3_.user_name;
               __ServerScore = _loc3_.__score;
               gameIsReady();
               break;
            case "endGame":
               dTrace("***CALLED endGame!");
               __SessionGold = _loc3_.total_gold;
               __AvatarItems = _loc3_.avatar_item_names;
               EndFromServer();
               break;
            case "useItem":
               dTrace("***CALLED useItem!");
               setPinballSIDs(_loc3_);
         }
      }
      
      public function takeShortcut(param1:Ball, ... rest) : void
      {
         __HitQueue.push(__ShortcutSID);
         dTrace("debu You took a shortcut!!");
      }
      
      public function clearArrays() : void
      {
         __HitQueue = null;
      }
      
      public function setVoteSIDs(param1:Object) : void
      {
         __MyTable.voteTargets.target0.setSID(param1.vote_target0);
         __MyTable.voteTargets.target1.setSID(param1.vote_target1);
         __MyTable.voteTargets.target2.setSID(param1.vote_target2);
         __MyTable.voteTargets.target3.setSID(param1.vote_target3);
         __MyTable.arenaBumper0.setSID(param1.arena_bumper0);
         __MyTable.arenaBumper1.setSID(param1.arena_bumper1);
         __MyTable.arenaBumper2.setSID(param1.arena_bumper2);
      }
      
      public function setNoGroupSIDs(param1:Object) : void
      {
         var _loc2_:int = 0;
         __ShortCut0 = param1.shortcut0;
         __MyTable.boutiqueramp.boutiqueSaucer.setSID(param1.barton_boutique);
         _loc2_ = 0;
         while(_loc2_ < __MyTable.TablePickups.length)
         {
            __MyTable.TablePickups[_loc2_].setSID(param1.gift_boxes);
            _loc2_++;
         }
         __MyTable.bot1Target.target0.setSID(param1.bot1);
         __MyTable.bot2Target.target0.setSID(param1.bot2);
         __MyTable.cowTarget.target0.setSID(param1.cow);
         __MyTable.zurgTarget.target0.setSID(param1.zurg_ship);
         __MyTable.rockpuppyTarget.target0.setSID(param1.rock_puppy);
         __ShortcutSID = param1.shortcut0;
      }
      
      public function finishExitRampHelson(param1:Ball, ... rest) : void
      {
         var _loc3_:int = 0;
         var _loc4_:MovieClip = null;
         var _loc5_:int = 0;
         var _loc6_:MovieClip = null;
         _loc3_ = 0;
         while(_loc3_ < __MyTable.Balls.length)
         {
            _loc4_ = __MyTable.Balls[_loc3_];
            if(Boolean(_loc4_.__Inplay) && _loc4_ != __MyTable.helsonSaucer.__LockObject)
            {
               _loc4_.setActive(true);
            }
            _loc3_++;
         }
         _loc5_ = 0;
         while(_loc5_ < __Flippers.length)
         {
            _loc6_ = __Flippers[_loc5_];
            _loc6_.setActive(true);
            _loc5_++;
         }
         __MyTable.helsonramp.setActive(false);
         __MyTable.mcBLights.visible = true;
         __MyTable.helsonMansion.deactivate(false);
         __MyTable.helsonDoorway.gotoAndPlay("hide");
         if(__MyTable.helsonSaucer.__LockObject != null)
         {
            __MyTable.helsonSaucer.ejectIn(1000);
         }
         __MyTable.gaiaLight.gotoAndStop(1);
         __MyTable.gambinoTargets.resetLevel();
         __HitQueue.push(__HelsonExitSID);
         dispatchQueue();
      }
      
      public function exitRampMKB(param1:Ball, ... rest) : void
      {
         param1.__Location = "table";
         __MyTable.controlRampGate(["mkbramp","close"]);
      }
      
      public function resetSlots() : void
      {
         __MyTable.slotsTargets.resetAll();
      }
      
      public function setHelsonSIDs(param1:Object) : void
      {
         __MyTable.helsonMansion.helsonSaucer.setSID(param1.von_helson_saucer);
         __MyTable.helsonramp.helsonTargets.target0.setSID(param1.von_helson_target0);
         __MyTable.helsonramp.helsonTargets.target1.setSID(param1.von_helson_target1);
         __MyTable.helsonramp.helsonTargets.target2.setSID(param1.von_helson_target2);
         __MyTable.helsonramp.helsonTargets.target3.setSID(param1.von_helson_target3);
         __MyTable.helsonramp.helsonTargets.target4.setSID(param1.von_helson_target4);
         __MyTable.helsonramp.helsonTargets.target5.setSID(param1.von_helson_target5);
         __MyTable.helsonramp.helsonTargets.target6.setSID(param1.von_helson_target6);
         __MyTable.helsonramp.helsonTargets.target7.setSID(param1.von_helson_target7);
         __MyTable.helsonramp.helsonTargets.target8.setSID(param1.von_helson_target8);
         __MyTable.helsonramp.helsonBumper0.setSID(param1.von_helson_bumper0);
         __MyTable.helsonramp.helsonBumper1.setSID(param1.von_helson_bumper1);
         __MyTable.helsonramp.helsonBumper2.setSID(param1.von_helson_bumper2);
         __MyTable.helsonramp.helsonBumper3.setSID(param1.von_helson_bumper3);
         __MyTable.helsonramp.helsonBumper4.setSID(param1.von_helson_bumper4);
         __HelsonExitSID = param1.von_helson_exit;
      }
      
      public function postEjectGambinoStart() : void
      {
         __MyTable.gambinoSaucer.eject(null);
         if(__MyTable.gambinoTargets.__GroupLevel == 1)
         {
            __MyTable.gambinoTargets.levelUp();
         }
         else if(__MyTable.gambinoTargets.__GroupLevel == 2)
         {
            if(__MyTable.gaiaLight.currentFrame == 5)
            {
               __MyTable.helsonMansion.activate();
               __MyTable.helsonDoorway.gotoAndPlay("show");
            }
            else
            {
               __MyTable.gambinoTargets.resetLevel();
            }
         }
      }
      
      public function playSound(param1:String) : void
      {
         if(soundController != null)
         {
            soundController.playSound(param1);
         }
      }
      
      public function voteComplete(... rest) : void
      {
         __MyTable.aniMessages.msgVote.play();
         __MyTable.cur_player.scoreIt("voteBonus",0);
         if(__MyTable.arenaBumper0.__Level < 5)
         {
            __MyTable.arenaBumper0.levelUp();
            __MyTable.arenaBumper1.levelUp();
            __MyTable.arenaBumper2.levelUp();
         }
         addCoin();
         dispatchQueue();
      }
      
      public function stopMagnatron(param1:TimerEvent) : void
      {
         var _loc2_:int = 0;
         var _loc3_:MovieClip = null;
         var _loc4_:int = 0;
         if(__MagnatronTimer.currentCount >= 60)
         {
            dTrace("Magnatron - Stop");
            if(__MagnatronTimer)
            {
               __MagnatronTimer.reset();
            }
            __MagnatronPause = false;
            __Magnatron = false;
            _loc2_ = 0;
            while(_loc2_ < __Flippers.length)
            {
               _loc3_ = __Flippers[_loc2_];
               _loc3_.gotoAndStop("NORMAL");
               _loc2_++;
            }
         }
         else
         {
            dTrace("Magnatron - Flash");
            _loc4_ = __MagnatronTimer.currentCount % 2;
            if(__MagnatronTimer.currentCount >= 50)
            {
               switch(_loc4_)
               {
                  case 0:
                     _loc2_ = 0;
                     while(_loc2_ < __Flippers.length)
                     {
                        _loc3_ = __Flippers[_loc2_];
                        _loc3_.gotoAndStop("NORMAL");
                        _loc2_++;
                     }
                     break;
                  case 1:
                     _loc2_ = 0;
                     while(_loc2_ < __Flippers.length)
                     {
                        _loc3_ = __Flippers[_loc2_];
                        _loc3_.gotoAndStop("STICKY");
                        _loc2_++;
                     }
               }
            }
         }
      }
      
      private function addCustomMenuItems() : void
      {
         var _loc1_:ContextMenuItem = null;
         _loc1_ = new ContextMenuItem(menuLabel + __Version);
         myContextMenu.customItems.push(_loc1_);
      }
      
      public function gameIsReady() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         if(__XMLComplete)
         {
            __MyTable.scoreboard.doStartGame(null);
            if(currentLabel != "Game")
            {
               super.gotoAndStop("Game");
            }
            if(userBar != null)
            {
               enableNewGameBtn();
            }
            if(userBar != null)
            {
               userBar.addNewGameListener(onNewGameRequest);
            }
         }
         else
         {
            dTrace("ScoreXML not complete or missing");
         }
         _loc1_ = 0;
         while(_loc1_ < __MyTable.scoreboard.inventory.numChildren)
         {
            _loc2_ = __MyTable.scoreboard.inventory.getChildAt(_loc1_);
            if(_loc2_ is InventoryItem)
            {
               (_loc2_ as InventoryItem).init(null);
            }
            _loc1_++;
         }
         __CharacterTimer.addEventListener("timer",doCharacter,false,0,true);
         __CharacterTimer.start();
         PinballCore.__EFM.start();
         __SessionGold = -1;
         __SafeBall = false;
      }
      
      public function resetHelson() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Flipper = null;
         __MyTable.gaiaLight.gotoAndStop(1);
         __MyTable.gambinoTargets.resetLevel();
         __MyTable.helsonramp.helsonTargets.resetLevel();
         _loc1_ = 0;
         while(_loc1_ < __Flippers.length)
         {
            _loc2_ = __Flippers[_loc1_];
            _loc2_.setActive(true);
            _loc1_++;
         }
         __MyTable.mcBLights.visible = true;
         __MyTable.helsonramp.deactivate();
         __MyTable.helsonramp.activeBall = null;
         __MyTable.helsonMansion.deactivate(true);
         __MyTable.helsonDoorway.gotoAndStop(1);
      }
      
      public function setFishSIDs(param1:Object) : void
      {
         __MyTable.fishTargets.target0.setSID(param1.fish_target0);
         __MyTable.fishTargets.target1.setSID(param1.fish_target1);
         __MyTable.fishTargets.target2.setSID(param1.fish_target2);
         __MyTable.fishTargets.target3.setSID(param1.fish_target3);
         __MyTable.fishBumper.setSID(param1.fishing_bumper);
         __MyTable.loganSaucer.setSID(param1.logan_fishing_hole);
      }
      
      public function resetLogan() : void
      {
         __MyTable.fishTargets.resetAll();
         __MyTable.fishBumper.resetAll();
      }
      
      public function helsonComplete(... rest) : void
      {
         __MyTable.cur_player.scoreIt("helsonBonus",0);
         exitRampHelson("win");
      }
      
      public function resetAllLights() : void
      {
         __MyTable.resetAllLights();
      }
      
      public function slotsComplete(... rest) : void
      {
         __MyTable.aniMessages.msgSlots.play();
         __MyTable.casinoLights.gotoAndPlay("ON");
         __MyTable.scoreboard.showMessage(new IGMDMessage("tellcasino"));
         __MyTable.cur_player.scoreIt("slotsBonus",1);
         playSound("casinoopen");
         __MyTable.controlRampGate(["gmramp","open"]);
      }
      
      public function exitRampHelson(... rest) : void
      {
         __MyTable.helsonramp.hBall.setActive(false);
         if(rest[0] == "win")
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("VH_win"));
         }
         else
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("VH_lose"));
         }
      }
      
      public function setTradeSIDs(param1:Object) : void
      {
         __MyTable.tradeTargets.target0.setSID(param1.trade_target0);
         __MyTable.tradeTargets.target1.setSID(param1.trade_target1);
         __MyTable.tradeTargets.target2.setSID(param1.trade_target2);
         __MyTable.tradeTargets.target3.setSID(param1.trade_target3);
         __MyTable.tradeTargets.target4.setSID(param1.trade_target4);
         __MyTable.bankramp.bankSaucer.setSID(param1.bank);
         __MyTable.marketramp.marketSaucer.setSID(param1.marketplace);
         __MultiballSID = param1.multiball_trigger;
      }
      
      public function enterMKBSaucer(param1:Ball, ... rest) : void
      {
         rest[0].eject(null);
      }
      
      public function bot1Invasion(param1:Event) : void
      {
         __CowTimer.removeEventListener("timer",bot1Invasion);
         if(__MyTable.__BallsInPlay > 0)
         {
            __MyTable.bot1Target.play();
         }
         else
         {
            __CowTimer.reset();
            __CowTimer.start();
         }
      }
      
      public function EndFromServer() : void
      {
         __CoinLights = 0;
         stopMusic();
         playMusic("music");
         __MyTable.reset(false);
         killListeners();
         resetInventory();
         PinballCore.__EFM.stop();
         mcDialogEG = new mcEndGame();
         addChild(mcDialogEG);
         if(userBar != null)
         {
            disableNewGameBtn();
         }
      }
      
      public function doPauseORG() : void
      {
         var _loc1_:int = 0;
         var _loc2_:Ball = null;
         __Pause = !__Pause;
         dTrace("debu Pause State is (" + __Pause + ")");
         _loc1_ = 0;
         while(_loc1_ < __MyTable.Balls.length)
         {
            _loc2_ = __MyTable.Balls[_loc1_];
            if(_loc2_.__Inplay)
            {
               if(__Pause)
               {
                  dTrace("debu deactivating Ball " + _loc2_);
                  _loc2_.setActive(false);
               }
               else
               {
                  dTrace("debu activating Ball " + _loc2_);
                  _loc2_.setActive(true);
               }
            }
            _loc1_++;
         }
      }
      
      public function tradeComplete(... rest) : void
      {
         __MyTable.aniMessages.msgTrade.play();
         __MyTable.cur_player.scoreIt("tradeBonus",0);
         if(__MyTable.tradeTargets.__GroupCount == 1)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("hitthebank"));
            __MyTable.bankLights.gotoAndPlay("ON");
            __MyTable.controlRampGate(["bankramp","open"]);
            playSound("bankopen");
         }
         else if(__MyTable.tradeTargets.__GroupCount == 2)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("hitthemarket"));
            __MyTable.marketLights.gotoAndPlay("ON");
            __MyTable.controlRampGate(["marketramp","open"]);
         }
         else if(__MyTable.tradeTargets.__GroupCount == 3)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("rampformultiball"));
            __MyTable.guildramp.multiballTrigger.setActive(true);
         }
      }
      
      public function pauseMagnatron() : void
      {
         dTrace("Magnatron - Pause");
         __MagnatronPause = true;
         __Magnatron = false;
         __MagnatronPauseTimer.addEventListener("timer",unPauseMagnatron,false,0,true);
         __MagnatronPauseTimer.start();
      }
      
      public function addCoin() : void
      {
         if(__MyTable.boutiqueLights.currentLabel != "ON")
         {
            __MyTable.boutiqueLights.gotoAndPlay("ON");
         }
         if(__CoinLights < 8 && __MyTable.coinLights != null)
         {
            __CoinLights += 1;
            if(__CoinLights > 7)
            {
               __CoinLights = 7;
            }
            __MyTable.coinLights.gotoAndStop(__CoinLights + 1);
            playSound("coinlight");
         }
      }
      
      public function setPinballSIDs(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:String = null;
         var _loc4_:* = undefined;
         var _loc5_:* = undefined;
         for(_loc2_ in param1)
         {
            _loc4_ = param1[_loc2_];
            for(_loc3_ in _loc4_)
            {
               _loc5_ = _loc4_[_loc3_];
            }
         }
         if(param1.fish != null)
         {
            setFishSIDs(param1.fish);
         }
         if(param1.nogroup != null)
         {
            setNoGroupSIDs(param1.nogroup);
         }
         if(param1.grunny != null)
         {
            setGrunnySIDs(param1.grunny);
         }
         if(param1.gambino != null)
         {
            setGambinoSIDs(param1.gambino);
         }
         if(param1.vote != null)
         {
            setVoteSIDs(param1.vote);
         }
         if(param1.slots != null)
         {
            setSlotsSIDs(param1.slots);
         }
         if(param1.von_helson != null)
         {
            setHelsonSIDs(param1.von_helson);
         }
         if(param1.trade != null)
         {
            setTradeSIDs(param1.trade);
         }
         if(param1.guild != null)
         {
            setGuildSIDs(param1.guild);
         }
         if(param1.flippers != null)
         {
            setFlippersIDs(param1.flippers);
         }
         if(param1.zurg_timer != null)
         {
            setZurgTime(param1.zurg_timer);
         }
         if(param1.rockpuppy_timer != null)
         {
            setRockpuppyTime(param1.rockpuppy_timer);
         }
         if(param1.gold_mountain_prize != null)
         {
            setGoldSIDs(param1.gold_mountain_prize);
         }
         __Cheating = param1.cheat;
         dTrace("Cheat flag set to: " + __Cheating + " by pb.cheat(" + param1.cheat + ")");
         if(param1.inventory != null)
         {
            setInventory(param1.inventory);
         }
      }
      
      public function doCharacter(param1:TimerEvent) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:MovieClip = null;
         _loc2_ = Math.floor(Math.random() * 100) + 1;
         _loc3_ = __MyTable.characters1;
         if(_loc2_ < 10 && _loc3_.currentFrame == 1)
         {
            _loc3_.play();
         }
         else if(_loc2_ < 10 && _loc3_.currentLabel == "backAtBank")
         {
            _loc3_.play();
         }
      }
      
      public function enterLoganSaucer(param1:Ball, ... rest) : void
      {
         __MyTable.mcBLights.sLightLogan.switchOn();
         playSound("enterlock");
         playSound("loganintro");
         __MyTable.cur_player.scoreIt("enterLoganSaucer",0,__MyTable.loganSaucer.__SID);
         if(__MyTable.fishTargets.__GroupCount > 0 && !__MyTable.fishTargets.maxLevelReached())
         {
            __MyTable.fishTargets.levelUp();
            __MyTable.surfaceLights.fish.switchOff();
            addCoin();
            if(Math.ceil(__MyTable.fishTargets.__GroupLevel / 3) > __MyTable.fishBumper.__Level)
            {
               __MyTable.fishBumper.levelUp();
            }
            __MyTable.scoreboard.showMessage(new IGMDMessage("loganFishOK"));
            playSound("FISHlevelup");
            dispatchQueue();
         }
         else if(__MyTable.fishTargets.maxLevelReached())
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("loganFishMAX"));
            if(__MyTable.fishTargets.__GroupCount > 0)
            {
               __MyTable.fishTargets.resetGroup();
               dispatchQueue();
            }
         }
         else
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("loganFishNO"));
         }
      }
      
      public function setSlotsSIDs(param1:Object) : void
      {
         __MyTable.slotsTargets.target0.setSID(param1.slots_target0);
         __MyTable.slotsTargets.target1.setSID(param1.slots_target1);
         __MyTable.slotsTargets.target2.setSID(param1.slots_target2);
         __MyTable.slotsTargets.target3.setSID(param1.slots_target3);
         __MyTable.slotsTargets.target4.setSID(param1.slots_target4);
         __MyTable.gmramp.tokenSpinner.setSID(param1.token_spinner);
         __MyTable.gmramp.saucers.gmSaucer.setSID(__IgnoreGMLockSID);
         __EndSlotEventSID = param1.gold_mountain;
      }
      
      public function hitSpinner(... rest) : void
      {
         switch(rest[0])
         {
            case "guildspinner":
            case "goldspinner":
         }
      }
      
      public function rockpuppyHit() : void
      {
         __MyTable.scoreboard.showMessage(new IGMDMessage("rockpuppyhit"));
         dispatchQueue();
      }
      
      public function getTotalGold() : String
      {
         userBar.updateGold();
         if(__SessionGold != -1)
         {
            return "YOU EARNED " + __SessionGold + " GOLD!";
         }
         return "0";
      }
      
      public function enterRampGuild(param1:Ball, ... rest) : void
      {
         param1.__Location = "guildramp";
      }
      
      public function setInventory(param1:Object) : void
      {
         var _loc2_:int = 0;
         var _loc3_:MovieClip = null;
         var _loc4_:InventoryItem = null;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         var _loc7_:Object = null;
         var _loc8_:String = null;
         _loc3_ = __MyTable.scoreboard.inventory;
         dTrace("Server returned the following inventory:");
         for(_loc8_ in param1)
         {
            _loc7_ = param1[_loc8_];
            dTrace("inv[" + _loc8_ + "] = " + _loc7_ + " {id = " + _loc7_.id + ", quantity = " + _loc7_.quantity + "}");
         }
         _loc2_ = 1;
         while(_loc2_ <= __MaxInventory)
         {
            _loc4_ = _loc3_["inv" + _loc2_];
            if(param1["item" + _loc2_] != null)
            {
               _loc5_ = int(param1["item" + _loc2_].id);
               _loc6_ = int(param1["item" + _loc2_].quantity);
               if(!_loc4_.__Active)
               {
                  _loc4_.activate(_loc5_,_loc6_);
               }
               else
               {
                  _loc4_.update(_loc5_,_loc6_);
               }
            }
            _loc2_++;
         }
      }
      
      public function enterRampMKB(param1:Ball, ... rest) : void
      {
         param1.__Location = "mkbramp";
      }
      
      public function zurgEscaped() : void
      {
         __MyTable.surfaceLights.zurg.switchOff();
      }
      
      public function enterRampGoldMountain(param1:Ball, ... rest) : void
      {
         param1.__Location = "gmramp";
         if(__MyTable.gmramp_art != null)
         {
            __MyTable.gmramp_art.alpha = 1;
         }
      }
      
      public function endRampGoldMountain(param1:Ball, ... rest) : void
      {
         __MyTable.goldMountain.door.gotoAndStop("CLOSE");
         param1.__Location = "table";
      }
      
      public function stopMusic() : void
      {
         if(soundController != null)
         {
            soundController.stopMusic();
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Pinball]",param1);
      }
      
      public function EndGame() : void
      {
         var _loc1_:int = 0;
         PinballCore.__EFM.stop();
         if(__SafeBallTimer.running)
         {
            __SafeBallTimer.stop();
         }
         __CharacterTimer.stop();
         __CharacterTimer.removeEventListener("timer",doCharacter);
         forceStopMagnatron(null);
         _loc1_ = 0;
         while(_loc1_ < __Flippers.length)
         {
            __Flippers[_loc1_].setActive(false);
            _loc1_++;
         }
         if(serverGateway != null)
         {
            serverGateway.call("endGame");
         }
         else
         {
            EndFromServer();
         }
      }
      
      private function createLabel() : TextField
      {
         var _loc1_:TextField = null;
         _loc1_ = new TextField();
         _loc1_.text = textLabel;
         return _loc1_;
      }
      
      internal function focusHandler(param1:FocusEvent) : void
      {
         if(param1.target)
         {
            if(param1.target.name != null && param1.target.name == "inputTxt")
            {
               if(param1.type == "focusOut")
               {
                  PinballCore.keyboardInput(true);
               }
               else if(param1.type == "focusIn")
               {
                  PinballCore.keyboardInput(false);
               }
            }
         }
      }
      
      public function doHelsonMode() : void
      {
         var _loc1_:int = 0;
         var _loc2_:MovieClip = null;
         var _loc3_:int = 0;
         var _loc4_:MovieClip = null;
         _loc1_ = 0;
         while(_loc1_ < __MyTable.Balls.length)
         {
            _loc2_ = __MyTable.Balls[_loc1_];
            _loc2_.setActive(false);
            _loc1_++;
         }
         _loc3_ = 0;
         while(_loc3_ < __Flippers.length)
         {
            _loc4_ = __Flippers[_loc3_];
            _loc4_.setActive(false);
            _loc3_++;
         }
         playSound("vonhelsonintro");
         __MyTable.scoreboard.showMessage(new IGMDMessage("castle_welcome"));
      }
      
      public function playMusic(param1:String, ... rest) : void
      {
         if(soundController != null)
         {
            soundController.playMusic(param1);
         }
      }
      
      public function countdownGuildEvent(param1:TimerEvent) : void
      {
         var _loc2_:uint = 0;
         _loc2_ = uint(param1.target.currentCount);
         if(_loc2_ == 120)
         {
            __MyTable.mcBLights.sLightGuild.switchOff();
            __MyTable.guildLights.gotoAndStop("OFF");
            __MyTable.guildramp.guildSpinner.stopSpinner();
            __MyTable.guildramp.guildSpinner.endEvent();
            __MyTable.guildTarget.resetGroup();
            __GuildTimer.reset();
            __HitQueue.push(__EndGuildEventSID);
            dispatchQueue();
         }
         if(_loc2_ > 100)
         {
            if(_loc2_ % 4 == 0)
            {
               __MyTable.mcBLights.sLightGuild.switchOff();
               __MyTable.guildTarget.target0.targetLight.gotoAndStop("OFF");
            }
            else
            {
               __MyTable.mcBLights.sLightGuild.switchOn();
               __MyTable.guildTarget.target0.targetLight.gotoAndStop("ON");
            }
         }
      }
      
      public function exitRampGuild(param1:Ball, ... rest) : void
      {
         if(rest[0] == "exit_ramp")
         {
            __MyTable.guildramp.guildSpinner.stopSpinner();
            __MyTable.guildramp.guildSpinner.levelUp();
         }
         param1.__Location = "table";
         __MyTable.guildramp_art.alpha = 0.3;
      }
      
      private function menuSelectHandler(param1:ContextMenuEvent) : void
      {
         dTrace("menuSelectHandler: " + param1);
      }
      
      public function fishComplete() : void
      {
         __MyTable.surfaceLights.fish.switchOn();
      }
      
      public function doCasinoRestack() : void
      {
         var _loc1_:Spinner = null;
         var _loc2_:int = 0;
         _loc1_ = __MyTable.gmramp.tokenSpinner;
         _loc2_ = __HitQueue.splice(__HitQueue.indexOf(__MyTable.gmramp.saucers.gmSaucer.__SID),1);
         __HitQueue.push(_loc2_);
         __GoldMountainMultiplier = _loc1_.__LastNumSpins;
         addCoin();
      }
      
      public function resetGrunny() : void
      {
         __MyTable.grunnyTargets.resetAll();
         __MyTable.fmLight.gotoAndStop(1);
      }
      
      public function awardPrize() : void
      {
         __MyTable.cur_player.scoreIt("slotsPrize" + __GoldMountainPrize,__GoldMountainMultiplier,__GoldMountainMultiplier);
         __GoldMountainMultiplier = 0;
         __MyTable.slotsTargets.resetGroup();
         __HitQueue.push(__EndSlotEventSID);
         dispatchQueue();
      }
      
      public function resetKitty() : void
      {
         if(__MyTable.kittyBumper != null)
         {
            __MyTable.kittyBumper.resetAll();
         }
      }
      
      public function initStage(param1:Event) : void
      {
         if(param1.target == this)
         {
            removeEventListener("addedToStage",initStage);
            KeyCheck.initialize(this.stage);
            stage.addEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown,false,0,true);
            stage.addEventListener(FocusEvent.FOCUS_IN,focusHandler,false,0,true);
            stage.addEventListener(FocusEvent.FOCUS_OUT,focusHandler,false,0,true);
            addEventListener("click",forceFocus,false,0,true);
            if(__DebugEnabled)
            {
               makeDebugger();
            }
            stage.frameRate = 50;
            if(userBar != null)
            {
               disableNewGameBtn();
            }
         }
      }
      
      public function resetGuild() : void
      {
         if(__GuildTimer.running)
         {
            __MyTable.guildramp.guildSpinner.stopSpinner();
            __MyTable.guildramp.guildSpinner.endEvent();
            __GuildTimer.reset();
         }
         __MyTable.mcBLights.sLightGuild.switchOff();
         __MyTable.guildLights.gotoAndStop("OFF");
         __MyTable.guildTarget.resetAll();
      }
      
      public function setGambinoSIDs(param1:Object) : void
      {
         __MyTable.gambinoTargets.target0.setSID(param1.gambino_target0);
         __MyTable.gambinoTargets.target1.setSID(param1.gambino_target1);
         __MyTable.gambinoTargets.target2.setSID(param1.gambino_target2);
         __MyTable.gambinoSaucer.setSID(param1.gambino_saucer);
      }
      
      public function enterRampMarket(param1:Ball, ... rest) : void
      {
         param1.__Location = "marketramp";
      }
      
      public function grunnyComplete(... rest) : void
      {
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         playSound("grunniescomplete");
         __MyTable.surfaceLights.grunny.switchOff();
         __MyTable.cur_player.scoreIt("grunnyBonus",0);
         _loc2_ = __MyTable.fmLight.currentFrame;
         if(_loc2_ < 5)
         {
            __MyTable.scoreboard.showMessage(new IGMDMessage("allgrunnies"));
            __MyTable.fmLight.gotoAndStop(_loc2_ + 1);
         }
         --__RockpuppySpawnCounter;
         if(__RockpuppySpawnCounter == 0)
         {
            _loc3_ = Math.floor(Math.random() * 30) + 1;
            __RockpuppyTimer = new Timer(_loc3_ * 1000,1);
            __RockpuppyTimer.removeEventListener("timer",rockpuppyAppear);
            __RockpuppyTimer.addEventListener("timer",rockpuppyAppear,false,0,true);
            __RockpuppyTimer.start();
         }
         dispatchQueue();
      }
      
      public function cowInvasion(param1:Event) : void
      {
         __CowTimer.removeEventListener("timer",cowInvasion);
         if(__MyTable.__BallsInPlay > 0)
         {
            __MyTable.cowTarget.play();
         }
         else
         {
            __CowTimer.reset();
            __CowTimer.start();
         }
      }
      
      public function gambinoComplete(... rest) : void
      {
         __MyTable.gambinoLights.gotoAndPlay("ON");
         __MyTable.surfaceLights.gambino.switchOn();
         if(__MyTable.gambinoTargets.__GroupLevel == 1)
         {
            __MyTable.gambinoTargets.openBreakthrough();
            __MyTable.casaGambino.doors.gotoAndStop("OPEN");
            __MyTable.mcBLights.sLightGambino.switchOn();
            __MyTable.scoreboard.showMessage(new IGMDMessage("shootGambinoForLabExplosion"));
         }
         else if(__MyTable.gambinoTargets.__GroupLevel == 2)
         {
            __MyTable.gambinoTargets.openBreakthrough();
            __MyTable.scoreboard.showMessage(new IGMDMessage("shootGambinoForRebuild"));
         }
      }
      
      public function cowTipped() : void
      {
         __MyTable.cowTarget.stop();
      }
   }
}

