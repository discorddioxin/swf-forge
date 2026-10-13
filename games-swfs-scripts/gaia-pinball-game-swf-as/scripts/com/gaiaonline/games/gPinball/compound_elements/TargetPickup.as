package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.PinballTable;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class TargetPickup extends Target
   {
      
      public function TargetPickup()
      {
         super();
         (PinballCore.__Table as PinballTable).TablePickups.push(this);
         addEventListener("enterFrame",init,false,0,true);
      }
      
      override public function hitTarget(... rest) : void
      {
         if(__Active)
         {
            if(targetLight != null)
            {
               activateLight(true);
            }
            if(__SndEffectHit != "none")
            {
               PinballCore.__Root.playSound(__SndEffectLevel ? __SndEffectHit + "" + __DropLevel : __SndEffectHit);
            }
            PinballCore.__Table.cur_player.scoreIt(__ScoreLink,__DropLevel,__SID);
            deactivate();
            PinballCore.__Root.__HitQueue.push(__SID);
            dispatchEvent(new Event("targetHit"));
         }
      }
      
      override public function init(... rest) : void
      {
         removeEventListener("enterFrame",init);
         if(__Location == "useParent")
         {
            __Location = (parent as MovieClip).__Location;
         }
         if(targetLight != null)
         {
            targetLight.rotation = -parent.rotation;
         }
         refresh();
      }
   }
}

