package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.BetterArray;
   import com.gaiaonline.games.gPinball.NumberTools;
   import com.gaiaonline.games.gPinball.Pinball;
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.PinballTable;
   import com.pixel.transitions.GaiaTransitionComponent;
   import flash.display.*;
   import flash.events.*;
   import flash.utils.*;
   
   public class SlotMachine extends MovieClip
   {
      
      public var slot3:MovieClip;
      
      public var slot1:MovieClip;
      
      public var slotMessage:MovieClip;
      
      public var slotScore:MovieClip;
      
      public var slot2:MovieClip;
      
      private var __prizeValue:int;
      
      public var slotMultiplier:MovieClip;
      
      private var __prizeMessage:String;
      
      private var __FrameOffsetToSingles:int = 12;
      
      private var __prizeMultiplier:int;
      
      private var __prizeID:int;
      
      public var slotTotal:MovieClip;
      
      private var __ResultSound:String;
      
      private var __result:BetterArray;
      
      public function SlotMachine()
      {
         super();
         dTrace("SlotMachine Constructor!");
      }
      
      public function setSlotState(param1:Event) : void
      {
         var _loc2_:int = 0;
         var _loc3_:Pinball = null;
         var _loc4_:PinballTable = null;
         var _loc5_:Spinner = null;
         _loc2_ = (param1.target as Timer).currentCount;
         switch(_loc2_)
         {
            case 6:
               slot1.gotoAndStop(__result[0] + __FrameOffsetToSingles);
               break;
            case 7:
               slot2.gotoAndStop(__result[1] + __FrameOffsetToSingles);
               break;
            case 8:
               slot3.gotoAndStop(__result[2] + __FrameOffsetToSingles);
               slotMessage.value.field.text = __prizeMessage;
               PinballCore.__Root.playSound(__ResultSound);
               slotMessage.gotoAndPlay("BLINK");
               break;
            case 9:
               break;
            case 10:
               slotScore.value.field.text = __prizeValue;
               slotScore.gotoAndPlay("PULSE");
               break;
            case 11:
               _loc3_ = PinballCore.__Root;
               _loc4_ = PinballCore.__Table;
               _loc5_ = _loc4_.gmramp.tokenSpinner;
               _loc5_.stopSpinner();
               _loc3_.doCasinoRestack();
               __prizeMultiplier = _loc5_.__ActualSpins;
            case 12:
               slotMultiplier.value.field.text = __prizeMultiplier;
               slotMultiplier.gotoAndPlay("PULSE");
               break;
            case 14:
               slotTotal.value.field.text = __prizeValue * __prizeMultiplier;
               slotTotal.gotoAndPlay("PULSE");
               break;
            case 16:
               finish();
         }
      }
      
      private function setResult(param1:int) : void
      {
         var _loc2_:int = 0;
         var _loc3_:Boolean = false;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:int = 0;
         _loc4_ = 0;
         __ResultSound = "slotwin" + param1;
         switch(param1)
         {
            case 0:
               _loc2_ = 0;
               while(_loc2_ < 3)
               {
                  _loc3_ = false;
                  while(!_loc3_)
                  {
                     dTrace("Contains " + _loc4_ + " ? " + __result.contains(_loc4_));
                     if(__result.contains(_loc4_) || _loc4_ == 0)
                     {
                        _loc4_ = NumberTools.getRandom(1,5,false);
                     }
                     else
                     {
                        __result[_loc2_] = _loc4_;
                        _loc3_ = true;
                     }
                  }
                  _loc2_++;
               }
               __prizeMessage = "YOU LOSE.";
               break;
            case 1:
               _loc2_ = 0;
               while(_loc2_ < 3)
               {
                  _loc3_ = false;
                  while(!_loc3_)
                  {
                     if(__result.contains(_loc4_) || _loc4_ == 0)
                     {
                        _loc4_ = NumberTools.getRandom(1,5,false);
                     }
                     else
                     {
                        __result[_loc2_] = _loc4_;
                        _loc3_ = true;
                     }
                  }
                  _loc2_++;
               }
               _loc5_ = -1;
               _loc6_ = NumberTools.getRandom(0,2,false);
               while(_loc5_ == _loc6_ || _loc5_ == -1)
               {
                  _loc5_ = NumberTools.getRandom(0,2,false);
               }
               __result[_loc5_] = __result[_loc6_];
               __prizeMessage = "YOU WIN.";
               break;
            case 2:
               fillResult(1);
               __prizeMessage = "YOU WIN!";
               break;
            case 3:
               fillResult(2);
               __prizeMessage = "YOU WIN!!";
               break;
            case 4:
               fillResult(3);
               __prizeMessage = "YOU WIN!!!";
               break;
            case 5:
               fillResult(4);
               __prizeMessage = "!!YOU WIN!!";
               break;
            case 6:
               fillResult(5);
               __prizeMessage = "JACKPOT!!";
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[SlotMachine]",param1);
      }
      
      public function start() : void
      {
         var _loc1_:Timer = null;
         slotMessage.value.field.text = "GOOD LUCK!";
         __result = null;
         __result = new BetterArray();
         slot2.gotoAndPlay(5);
         slot3.gotoAndPlay(9);
         dTrace(":--:GoldMountainPrize is " + PinballCore.__Root.__GoldMountainPrize);
         __prizeID = PinballCore.__Root.__GoldMountainPrize;
         __prizeMultiplier = PinballCore.__Root.__GoldMountainMultiplier;
         __prizeValue = PinballCore.__Table.cur_player.__ScoreValues["slotsPrize" + __prizeID];
         setResult(__prizeID);
         _loc1_ = new Timer(500,16);
         _loc1_.addEventListener("timer",setSlotState,false,0,true);
         _loc1_.start();
      }
      
      public function fillResult(param1:int) : void
      {
         var _loc2_:int = 0;
         _loc2_ = 0;
         while(_loc2_ < 3)
         {
            __result[_loc2_] = param1;
            _loc2_++;
         }
      }
      
      public function finish() : void
      {
         (parent.parent as GaiaTransitionComponent).forceTransitionComplete();
      }
   }
}

