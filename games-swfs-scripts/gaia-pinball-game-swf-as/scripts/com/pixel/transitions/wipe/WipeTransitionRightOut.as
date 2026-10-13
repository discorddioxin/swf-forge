package com.pixel.transitions.wipe
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import com.pixel.transitions.TransitionPixel;
   import flash.events.IEventDispatcher;
   
   public class WipeTransitionRightOut extends BaseTransition
   {
      
      public function WipeTransitionRightOut(param1:String, param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      override public function start(param1:int = 1000) : void
      {
         var _loc2_:Number = NaN;
         _loc2_ = __boundingRect.width * 2;
         Tweener.addTween(__target,{
            "xP":_loc2_,
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

