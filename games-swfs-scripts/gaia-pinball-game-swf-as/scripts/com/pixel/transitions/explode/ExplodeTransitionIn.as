package com.pixel.transitions.explode
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   import flash.geom.Point;
   
   public class ExplodeTransitionIn extends BaseTransition
   {
      
      public function ExplodeTransitionIn(param1:String, param2:IEventDispatcher = null)
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
            "alpha":1,
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
         __target.xP = Math.sin(Math.random() * Math.PI * 2) * __boundingRect.width;
         __target.yP = Math.cos(Math.random() * Math.PI * 2) * __boundingRect.height;
         __target.alpha = 0;
         __target.update();
      }
   }
}

