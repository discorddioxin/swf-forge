package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   
   public class RampMarketKickBack extends Ramp
   {
      
      public var gateArt:MovieClip;
      
      public var market_kb_closed_trigger:Trigger;
      
      public var MKBSaucer:Saucer;
      
      public function RampMarketKickBack()
      {
         super();
         __Location = "mkbramp";
         __InitFunc = initGate;
         __HasScore = false;
         __HasBrake = false;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampMarketKickBack]",param1);
      }
      
      public function initGate() : void
      {
         enter_ramp.setActive(false);
         gateArt.gotoAndPlay("CLOSEGATE");
      }
   }
}

