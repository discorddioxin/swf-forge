package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   public class RampGoldMountain extends Ramp
   {
      
      public var gm_trigger:MovieClip;
      
      public var gateArt:MovieClip;
      
      public var gmSaucer:Saucer;
      
      public var gmSaucerEject:MovieClip;
      
      public var market_trigger:MovieClip;
      
      public var bank_trigger:MovieClip;
      
      public var tokenSpinner:Spinner;
      
      public function RampGoldMountain()
      {
         super();
         __Location = "gmramp";
         __InitFunc = initGate;
         __HasScore = false;
         __HasBrake = false;
      }
      
      public function initGate() : void
      {
         enter_ramp.setActive(false);
         gateArt.gotoAndPlay("CLOSEGATE");
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampGoldMountain]",param1);
      }
   }
}

