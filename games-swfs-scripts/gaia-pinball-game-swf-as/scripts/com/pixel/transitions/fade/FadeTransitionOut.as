package com.pixel.transitions.fade
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   
   public class FadeTransitionOut extends BaseTransition
   {
      
      public function FadeTransitionOut(param1:String, param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      override public function start(param1:int = 1000) : void
      {
         Tweener.addTween(__target,{
            "alpha":0,
            "time":param1 / 1000,
            "transition":__easeType,
            "onComplete":transitionComplete
         });
      }
      
      override public function init(param1:TransitionPixel) : void
      {
         param1.alpha = 1;
         super.init(param1);
      }
   }
}

