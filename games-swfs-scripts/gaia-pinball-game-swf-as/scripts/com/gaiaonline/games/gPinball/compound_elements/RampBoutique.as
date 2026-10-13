package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   
   public class RampBoutique extends Ramp
   {
      
      public var boutiqueSaucer:Saucer;
      
      public function RampBoutique()
      {
         super();
         __Location = "boutiqueramp";
         __HasScore = false;
         __HasBrake = false;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampBoutique]",param1);
      }
   }
}

