package com.pixel.transitions.wipe
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   import flash.geom.Point;
   
   public class WipeTransitionRightIn extends BaseTransition
   {
      
      public function WipeTransitionRightIn(param1:String = "linear", param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      private function customTransitonComplete() : void
      {
         __target.xP = __endPt.x;
         __target.yP = __endPt.y;
         transitionComplete();
      }
      
      override public function start(param1:int = 1000) : void
      {
         Tweener.addTween(__target,{
            "xP":__endPt.x,
            "yP":__endPt.y,
            "time":param1 / 1000,
            "transition":__easeType,
            "onComplete":customTransitonComplete
         });
      }
      
      override public function init(param1:TransitionPixel) : void
      {
         super.init(param1);
         __endPt = new Point();
         __endPt.x = __target.xP;
         __endPt.y = __target.yP;
         __target.xP = __boundingRect.width * 1.5;
         __target.update();
      }
   }
}

