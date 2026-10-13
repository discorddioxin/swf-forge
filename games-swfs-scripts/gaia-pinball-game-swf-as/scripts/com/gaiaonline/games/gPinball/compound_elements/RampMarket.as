package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   
   public class RampMarket extends Ramp
   {
      
      public var market_closed_trigger:Trigger;
      
      public var marketSaucer:Saucer;
      
      public var gateArt:MovieClip;
      
      public var market_to_kickback_trigger:Trigger;
      
      public function RampMarket()
      {
         super();
         __Location = "marketramp";
         __InitFunc = initGate;
         __HasScore = false;
         __HasBrake = false;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampMarket]",param1);
      }
      
      public function initGate() : void
      {
         enter_ramp.setActive(false);
         gateArt.gotoAndPlay("CLOSEGATE");
      }
   }
}

