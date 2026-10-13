package com.pixel.transitions.explode
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   
   public class ExplodeTransitionOut extends BaseTransition
   {
      
      public function ExplodeTransitionOut(param1:String, param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      override public function start(param1:int = 1000) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:Number = NaN;
         _loc2_ = Math.sin(Math.random() * Math.PI * 2) * __boundingRect.width * 1.5;
         _loc3_ = Math.cos(Math.random() * Math.PI * 2) * __boundingRect.height * 1.5;
         Tweener.addTween(__target,{
            "xP":_loc2_,
            "yP":_loc3_,
            "alpha":0,
            "time":param1 / 1000,
            "transition":__easeType,
            "onComplete":transitionComplete
         });
      }
      
      override public function init(param1:TransitionPixel) : void
      {
         super.init(param1);
      }
   }
}

