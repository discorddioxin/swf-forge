package com.gaiaonline.games.gPinball
{
   import com.custom.KeyCheck;
   import com.gaiaonline.games.gPinball.igmd.IGMDMessage;
   import com.gaiaonline.games.gPinball.simple_elements.Ball;
   import com.gaiaonline.games.gPinball.simple_elements.InventoryItem;
   import com.pixel.events.*;
   import com.pixel.transitions.*;
   import flash.display.MovieClip;
   import flash.events.*;
   import flash.utils.*;
   
   public class PinballScoreBoard extends MovieClip
   {
      
      public var __IGMDQueue:Array;
      
      public var __CurrentItem:int = 1;
      
      public var new_game:Boolean;
      
      private var powUsed:Boolean;
      
      public var overlay:MovieClip;
      
      public var __CurrentMessage:IGMDMessage;
      
      public var inventory:MovieClip;
      
      public var __MyTable:PinballTable;
      
      public var __NextItem:int = 2;
      
      public var IGMD_MASTER:GaiaTransitionComponent;
      
      public var __PreviousItem:int = 7;
      
      public var __LedCountScoreDisplay:int = 9;
      
      public var powTimeOut:Timer;
      
      public var ball_indicator:MovieClip;
      
      public var score1:MovieClip;
      
      public function PinballScoreBoard()
      {
         super();
         init();
      }
      
      public function onAnimate(param1:Event) : void
      {
         var eventObj:Event = param1;
         if(__IGMDQueue)
         {
            __IGMDQueue.shift();
         }
         try
         {
            switch(__CurrentMessage.id)
            {
               case "activatePOW_Floaties":
               case "activatePOW_Insurance":
               case "activatePOW_Sticky":
               case "activatePOW_Fishnet":
               case "activatePOW_Marbles":
               case "activatePOW_Goldmine":
               case "activatePOW_Armadillo":
                  enablePowUse(null);
                  break;
               case "loganFishNO":
                  __MyTable.loganSaucer.eject(null);
                  __MyTable.mcBLights.sLightLogan.switchOff();
                  break;
               case "multiballJackpot":
               case "multiball":
                  break;
               case "loganFishOK":
                  __MyTable.loganSaucer.eject(null);
                  __MyTable.mcBLights.sLightLogan.switchOff();
                  break;
               case "loganFishMAX":
                  __MyTable.loganSaucer.eject(null);
                  __MyTable.mcBLights.sLightLogan.switchOff();
                  break;
               case "gambinoRebuild":
                  __MyTable.gaiaLight.gotoAndStop(__MyTable.gaiaLight.currentFrame + 1);
                  if(__MyTable.gaiaLight.currentFrame < 5)
                  {
                     PinballCore.__Root.playSound("GAIAletter");
                  }
                  else
                  {
                     PinballCore.__Root.playSound("GAIAcomplete");
                  }
               case "gambinoLab":
               case "gambinoShootHelson":
                  PinballCore.__Root.postEjectGambinoStart();
                  break;
               case "startball":
                  __MyTable.startPlayer();
                  showMessage(new IGMDMessage("useplunger"));
                  break;
               case "gameover":
                  dTrace("OnAnimate(gameOver)");
                  __MyTable.cur_player.gameOver();
                  break;
               case "repelzurg":
                  break;
               case "peaceisrestored":
                  __MyTable.zurgTarget.gotoAndStop(1);
                  break;
               case "castle_welcome":
                  __MyTable.mcBLights.visible = false;
                  __MyTable.helsonramp.activate();
                  __MyTable.helsonramp.activeBall = __MyTable.helsonramp.hBall;
                  __MyTable.helsonramp.launchSaucer.__LockObject = null;
                  __MyTable.helsonramp.launchSaucer.enterSaucer(__MyTable.helsonramp.hBall);
                  break;
               case "VH_win":
                  __MyTable.helsonramp.helsonTargets.resetLevel();
               case "VH_lose":
                  __MyTable.helsonramp.activeBall = null;
                  __MyTable.helsonramp.deactivate();
                  PinballCore.__Root.dispatchQueue();
                  break;
               case "rockpuppyhit":
                  __MyTable.rockpuppyTarget.gotoAndStop(1);
                  break;
               case "useplunger":
                  break;
               case "banklock":
                  __MyTable.tradeTargets.popAll();
                  __MyTable.launchLights.gotoAndPlay("BLINK");
                  __MyTable.bankramp.bankSaucer.__LockObject.removeFromPlay();
                  __MyTable.bankramp.bankSaucer.__LockObject.initBall(false,true,0);
                  __MyTable.bankramp.bankSaucer.__LockObject = null;
                  __MyTable.mcBLights.sLightBank.switchOff();
                  break;
               case "marketlock":
                  __MyTable.tradeTargets.popAll();
                  __MyTable.launchLights.gotoAndPlay("BLINK");
                  __MyTable.marketramp.marketSaucer.__LockObject.removeFromPlay();
                  __MyTable.marketramp.marketSaucer.__LockObject.initBall(false,true,0);
                  __MyTable.marketramp.marketSaucer.__LockObject = null;
                  __MyTable.mcBLights.sLightMarket.switchOff();
                  break;
               case "slotmachine":
                  PinballCore.__Root.awardPrize();
                  __MyTable.gmramp.saucers.gmSaucer.eject(null);
                  __MyTable.goldMountain.door.gotoAndStop("OPEN");
                  __MyTable.mcBLights.sLightCasino.switchOff();
                  __MyTable.slotsTargets.resetAll();
                  break;
               case "slotmachineX":
                  PinballCore.__Root.doPause();
                  break;
               case "rufus_inv0":
               case "rufus_inv1":
               case "rufus_inv2":
               case "rufus_inv3":
               case "rufus_inv4":
               case "rufus_inv5":
               case "rufus_inv6":
               case "rufus_inv7":
               case "rufus_inv0pushed":
               case "rufus_inv1pushed":
               case "rufus_inv2pushed":
               case "rufus_inv3pushed":
               case "rufus_inv4pushed":
               case "rufus_inv5pushed":
               case "rufus_inv6pushed":
               case "rufus_inv7pushed":
                  PinballCore.__Root.resetBoutique();
                  __MyTable.boutiqueramp.boutiqueSaucer.eject(null);
                  __MyTable.mcBLights.sLightBoutique.switchOff();
                  break;
               case "bonus":
                  __MyTable.cur_player.scoreIt("TurnBonus for Multiplier",__MyTable.cur_player.__TurnBonus,999);
                  __MyTable.cur_player.finishBallDrain();
                  break;
               case "shootGambinoForLabExplosion":
               case "shootGambinoForRebuild":
            }
         }
         catch(e:Error)
         {
            dTrace("ERROR 2: (" + e.errorID + ") " + e.message);
         }
         try
         {
            overlay.visible = false;
            if(__IGMDQueue.length)
            {
               animateMessage(__IGMDQueue[0]);
            }
            else
            {
               __CurrentMessage = null;
            }
         }
         catch(e2:Error)
         {
            dTrace("ERROR 2: (" + e2.errorID + ") " + e2.message);
         }
      }
      
      public function displayItem(param1:int) : void
      {
         dTrace("Curr Inv Item = " + inventory.currentLabel);
         if(inventory.currentLabel == "pow" + param1)
         {
            dTrace("On t so use it");
            useItem(true);
         }
         else
         {
            dTrace("Not on it so get on it");
            inventory.gotoAndPlay("pow" + param1);
            __CurrentItem = param1;
         }
      }
      
      public function init() : void
      {
         overlay.visible = false;
         powUsed = false;
         powTimeOut = new Timer(1000,1);
         powTimeOut.addEventListener("timer",enablePowUse,false,0,true);
         __CurrentMessage = null;
         __IGMDQueue = new Array();
         __MyTable = PinballCore.__Table;
         IGMD_MASTER.removeEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,onAnimate);
         IGMD_MASTER.addEventListener(TransitionEvent.SCENE_TRANSITION_COMPLETE,onAnimate,false,0,true);
         addEventListener("addedToStage",doListen,false,0,true);
      }
      
      public function doStartGame(param1:Event) : void
      {
         if(!__MyTable)
         {
            __MyTable = PinballCore.__Table;
         }
         __MyTable.startGame();
      }
      
      public function doListen(param1:Event) : void
      {
         removeEventListener("addedToStage",doListen);
         if(param1.target == this)
         {
            stage.removeEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown);
            stage.addEventListener(KeyboardEvent.KEY_DOWN,checkKeyDown,false,0,true);
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[ScoreBoard]",param1);
      }
      
      public function setScore(param1:int = 1, param2:int = 0) : void
      {
         var _loc3_:String = null;
         var _loc4_:String = null;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         _loc3_ = param2.toString();
         _loc5_ = 0;
         while(_loc5_ < __LedCountScoreDisplay)
         {
            if(param2.toString() == "off")
            {
               score1["lcd" + _loc5_].gotoAndStop("OFF");
            }
            else
            {
               score1["lcd" + _loc5_].gotoAndStop("ON");
               _loc6_ = _loc3_.length - 1 - _loc5_;
               if(_loc6_ >= 0)
               {
                  _loc4_ = _loc3_.charAt(_loc6_);
               }
               else
               {
                  _loc4_ = "";
               }
               score1["lcd" + _loc5_].lcdNumber.txt_number.text = _loc4_;
            }
            _loc5_++;
         }
      }
      
      public function showMessage(param1:IGMDMessage) : void
      {
         __IGMDQueue.push(param1);
         if(__CurrentMessage == null)
         {
            animateMessage(param1);
         }
      }
      
      public function enablePowUse(param1:TimerEvent) : void
      {
         powUsed = false;
         powTimeOut.reset();
      }
      
      public function useItem(param1:Boolean = false) : void
      {
         var _loc2_:Ball = null;
         var _loc3_:Boolean = false;
         var _loc4_:Boolean = false;
         var _loc5_:Boolean = false;
         var _loc6_:String = null;
         var _loc7_:InventoryItem = null;
         var _loc8_:int = 0;
         var _loc9_:int = 0;
         var _loc10_:Boolean = false;
         var _loc11_:int = 0;
         if(__MyTable.__BallsInPlay > 0 && PinballCore.__EFM.__Active)
         {
            _loc3_ = KeyCheck.isDown(__MyTable.__DefaultInventoryRIGHT);
            _loc4_ = KeyCheck.isDown(__MyTable.__DefaultInventoryLEFT);
            _loc5_ = KeyCheck.isDown(__MyTable.__DefaultInventoryUSE);
            __NextItem = __CurrentItem + 1;
            __PreviousItem = __CurrentItem - 1;
            if(__NextItem > PinballCore.__Root.__MaxInventory)
            {
               __NextItem = 1;
            }
            if(__PreviousItem < 1)
            {
               __PreviousItem = PinballCore.__Root.__MaxInventory;
            }
            _loc6_ = inventory.currentLabel.substr(0,9);
            if(_loc3_ && !_loc4_)
            {
               if(_loc6_ != "forwardTo")
               {
                  inventory.gotoAndPlay("forwardTo" + __NextItem);
                  __CurrentItem = __NextItem;
               }
            }
            else if(_loc4_ && !_loc3_)
            {
               if(_loc6_ != "backwardT")
               {
                  inventory.gotoAndPlay("backwardTo" + __PreviousItem);
                  __CurrentItem = __PreviousItem;
               }
            }
            if((_loc5_ || param1) && !powUsed)
            {
               _loc7_ = inventory["inv" + __CurrentItem];
               _loc9_ = __MyTable.fmLight.currentFrame;
               if(_loc7_.__Active)
               {
                  dTrace("Inventory item" + __CurrentItem + " was active");
                  switch(__CurrentItem)
                  {
                     case 1:
                        if(__MyTable.__ActiveBalls > 0 && __MyTable.helsonramp.__Active == false)
                        {
                           _loc8_ = 1;
                           while(_loc8_ <= __MyTable.__MaxBalls)
                           {
                              _loc2_ = PinballCore.__Table["ball" + _loc8_];
                              if(_loc2_.__Inplay && _loc2_.__Active && __MyTable.helsonramp.__Active == false && _loc2_.__Location == "table")
                              {
                                 PinballCore.__Root.playSound("PUfloaties");
                                 showMessage(new IGMDMessage("activatePOW_Floaties"));
                                 _loc2_.removeFromPlay();
                                 _loc2_.initBall(false,false,0);
                                 _loc8_ = __MyTable.__MaxBalls + 1;
                                 powUsed = true;
                              }
                              _loc8_++;
                           }
                        }
                        break;
                     case 2:
                        if(__MyTable.cur_player.__CurrentBall <= __MyTable.__MaxBalls && __MyTable.helsonramp.__Active == false && !(__MyTable.bkbramp.enter_ramp.active && __MyTable.mkbramp.enter_ramp.active))
                        {
                           PinballCore.__Root.playSound("PUinsurance");
                           showMessage(new IGMDMessage("activatePOW_Insurance"));
                           PinballCore.__Root.controlRampGate(["bkbramp","open"]);
                           PinballCore.__Root.controlRampGate(["mkbramp","open"]);
                           powUsed = true;
                        }
                        break;
                     case 3:
                        if(!PinballCore.__Root.__Magnatron && !PinballCore.__Root.__MagnatronPause)
                        {
                           PinballCore.__Root.playSound("PUsticky");
                           showMessage(new IGMDMessage("activatePOW_Sticky"));
                           PinballCore.__Root.startMagnatron();
                           powUsed = true;
                        }
                        break;
                     case 4:
                        if(__MyTable.cur_player.__CurrentBall <= __MyTable.__MaxBalls && __MyTable.helsonramp.__Active == false && __MyTable.fishTargets.__GroupLevel < __MyTable.fishTargets.__MaxLevel)
                        {
                           PinballCore.__Root.playSound("PUfishnet");
                           showMessage(new IGMDMessage("activatePOW_Fishnet"));
                           __MyTable.fishTargets.levelUp();
                           __MyTable.fishTargets.levelUp();
                           __MyTable.fishTargets.levelUp();
                           if(Math.ceil(__MyTable.fishTargets.__GroupLevel / 3) > __MyTable.fishBumper.__Level)
                           {
                              __MyTable.fishBumper.levelUp();
                           }
                           powUsed = true;
                        }
                        break;
                     case 5:
                        if(!__MyTable.multiball && __MyTable.helsonramp.__Active == false)
                        {
                           _loc10_ = false;
                           _loc11_ = 0;
                           while(_loc11_ < __MyTable.Balls.length)
                           {
                              _loc2_ = __MyTable.Balls[_loc11_];
                              if(_loc2_.__NewBall || PinballCore.__Root.__SafeBall || _loc2_.__Inplay && _loc2_.x > 426)
                              {
                                 _loc10_ = true;
                              }
                              _loc11_++;
                           }
                           if(!_loc10_)
                           {
                              PinballCore.__Root.playSound("PUmarbles");
                              showMessage(new IGMDMessage("activatePOW_Marbles"));
                              __MyTable.startMultiball();
                              powUsed = true;
                           }
                        }
                        break;
                     case 6:
                        if(__MyTable.helsonramp.__Active == false)
                        {
                           _loc9_ = __MyTable.fmLight.currentFrame;
                           if(_loc9_ < 5)
                           {
                              PinballCore.__Root.playSound("PUgoldmine");
                              showMessage(new IGMDMessage("activatePOW_Goldmine"));
                              __MyTable.fmLight.gotoAndStop(_loc9_ + 1);
                              powUsed = true;
                           }
                        }
                        break;
                     case 7:
                        if(__MyTable.cur_player.__CurrentBall <= __MyTable.__MaxBalls && __MyTable.cur_player.__CurrentBall > -4)
                        {
                           PinballCore.__Root.playSound("PUarmadillo");
                           showMessage(new IGMDMessage("activatePOW_Armadillo"));
                           __MyTable.cur_player.extraBall();
                           powUsed = true;
                        }
                  }
                  if(powUsed)
                  {
                     _loc7_.deactivate(true);
                  }
               }
               else
               {
                  PinballCore.__Root.playSound("powerupError");
               }
               if(powUsed && !powTimeOut.running)
               {
                  powTimeOut.start();
               }
            }
         }
      }
      
      public function checkKeyDown(param1:Event) : void
      {
         var _loc2_:int = 0;
         if(PinballCore.__Root == null || __MyTable == null)
         {
            return;
         }
         if(PinballCore.__KeyboardIO)
         {
            _loc2_ = int((param1 as KeyboardEvent).keyCode);
            switch(_loc2_)
            {
               case __MyTable.__DefaultInventoryRIGHT:
               case __MyTable.__DefaultInventoryLEFT:
               case __MyTable.__DefaultInventoryUSE:
                  useItem();
                  break;
               case 49:
               case 50:
               case 51:
               case 52:
               case 53:
               case 54:
               case 55:
                  displayItem(_loc2_ - 48);
            }
         }
      }
      
      public function newBall(param1:int) : void
      {
      }
      
      public function animateMessage(param1:IGMDMessage) : void
      {
         var AssetClass:Class = null;
         var msgObject:IGMDMessage = param1;
         __CurrentMessage = msgObject;
         try
         {
            AssetClass = getDefinitionByName("igmd_" + msgObject.id) as Class;
            IGMD_MASTER.image = "igmd_" + msgObject.id;
         }
         catch(e:Error)
         {
            dTrace("IGMD Missing Message: " + "igmd_" + msgObject.id);
            dTrace("IGMD Missing Message: " + "igmd_" + msgObject.id);
            IGMD_MASTER.image = "igmd_placeholder";
         }
         if(__MyTable.__ActiveBalls > 0)
         {
            overlay.visible = false;
            IGMD_MASTER.introDuration = 0;
            IGMD_MASTER.outroDuration = 0;
            IGMD_MASTER.pauseDuration = 3000;
         }
         else
         {
            overlay.visible = true;
            IGMD_MASTER.introDuration = 0;
            IGMD_MASTER.outroDuration = 0;
            IGMD_MASTER.pauseDuration = 3000;
         }
         IGMD_MASTER.start();
      }
      
      public function newGameClick() : void
      {
         new_game = true;
      }
   }
}

