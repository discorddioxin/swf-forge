package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   
   public class RampBankKickBack extends Ramp
   {
      
      public var gateArt:MovieClip;
      
      public var bank_kb_closed_trigger:Trigger;
      
      public var BKBSaucer:Saucer;
      
      public function RampBankKickBack()
      {
         super();
         __Location = "bkbramp";
         __InitFunc = initGate;
         __HasScore = false;
         __HasBrake = false;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[BKBRamp]",param1);
      }
      
      public function initGate() : void
      {
         enter_ramp.setActive(false);
         gateArt.gotoAndPlay("CLOSEGATE");
      }
   }
}

