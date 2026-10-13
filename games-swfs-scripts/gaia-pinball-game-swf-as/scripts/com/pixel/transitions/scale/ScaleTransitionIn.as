package com.pixel.transitions.scale
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   
   public class ScaleTransitionIn extends BaseTransition
   {
      
      public function ScaleTransitionIn(param1:String, param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      private function customTransitonComplete() : void
      {
         __target.scaleX = 1;
         __target.scaleY = 1;
         transitionComplete();
      }
      
      override public function start(param1:int = 1000) : void
      {
         Tweener.addTween(__target,{
            "xS":1,
            "yS":1,
            "alpha":1,
            "time":param1 / 1000,
            "transition":__easeType,
            "onComplete":customTransitonComplete
         });
      }
      
      override public function init(param1:TransitionPixel) : void
      {
         param1.alpha = 0;
         param1.xS = 8;
         param1.yS = 8;
         param1.update();
         super.init(param1);
      }
   }
}

