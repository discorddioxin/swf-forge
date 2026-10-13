package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class KickBumper extends MovieClip
   {
      
      public var __SndEffect:String = "none";
      
      public var __Location:String = "table";
      
      public var kickbase_mc:Obstacle;
      
      public var __SID:int = 13;
      
      public function KickBumper()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function init(param1:Event) : void
      {
         removeEventListener("enterFrame",init);
         kickbase_mc.init(1,2,__Location,bumperHit,0);
      }
      
      public function setSID(param1:int) : void
      {
         __SID = param1;
      }
      
      public function getLocation() : String
      {
         return __Location;
      }
      
      internal function bumperHit(... rest) : void
      {
         if(__SndEffect != "none")
         {
            PinballCore.__Root.playSound(__SndEffect);
         }
         PinballCore.__Root.__HitQueue.push(__SID);
         gotoAndPlay("kick");
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Kicker]",param1);
      }
   }
}

