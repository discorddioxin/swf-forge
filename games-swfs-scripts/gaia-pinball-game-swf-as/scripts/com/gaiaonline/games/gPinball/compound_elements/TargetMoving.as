package com.gaiaonline.games.gPinball.compound_elements
{
   import flash.display.MovieClip;
   
   public class TargetMoving extends Target
   {
      
      public function TargetMoving()
      {
         super();
      }
      
      override public function hitTarget(... rest) : void
      {
         super.hitTarget(rest);
         if(targetLight.graphic)
         {
            targetLight.graphic.addEventListener("animDone",dropDone,false,0,true);
         }
      }
      
      public function dropDone() : void
      {
         gotoAndStop(1);
         (parent.parent as MovieClip).gotoAndStop(1);
      }
   }
}

