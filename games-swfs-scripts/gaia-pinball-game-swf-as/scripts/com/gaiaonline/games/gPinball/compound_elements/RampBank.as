package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   
   public class RampBank extends Ramp
   {
      
      public var bank_closed_trigger:Trigger;
      
      public var bankSaucer:Saucer;
      
      public var gateArt:MovieClip;
      
      public var bank_to_kickback_trigger:Trigger;
      
      public function RampBank()
      {
         super();
         __Location = "bankramp";
         __InitFunc = initGate;
         __HasScore = false;
         __HasBrake = false;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampBank]",param1);
      }
      
      public function initGate() : void
      {
         enter_ramp.setActive(false);
         gateArt.gotoAndPlay("CLOSEGATE");
      }
   }
}

