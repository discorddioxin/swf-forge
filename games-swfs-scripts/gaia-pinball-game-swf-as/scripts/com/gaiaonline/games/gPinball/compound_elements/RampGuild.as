package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.MovieClip;
   
   public class RampGuild extends Ramp
   {
      
      public var gm_trigger:Trigger;
      
      public var guildLevel:MovieClip;
      
      public var guildSpinner:Spinner;
      
      public var multiballTrigger:Trigger;
      
      public function RampGuild()
      {
         super();
         __Location = "guildramp";
         __HasScore = true;
         __HasBrake = true;
      }
      
      override public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[RampGuild]",param1);
      }
   }
}

