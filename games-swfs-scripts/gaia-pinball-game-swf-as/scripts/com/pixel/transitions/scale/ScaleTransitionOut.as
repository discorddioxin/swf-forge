package com.pixel.transitions.scale
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   
   public class ScaleTransitionOut extends BaseTransition
   {
      
      public function ScaleTransitionOut(param1:String, param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      override public function start(param1:int = 1000) : void
      {
         Tweener.addTween(__target,{
            "xS":8,
            "yS":8,
            "alpha":0,
            "time":param1 / 1000,
            "transition":"linear",
            "onComplete":transitionComplete
         });
      }
      
      override public function init(param1:TransitionPixel) : void
      {
         param1.update();
         super.init(param1);
      }
   }
}

