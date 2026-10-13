package com.pixel.transitions.wipe
{
   import com.pixel.motion.Tweener;
   import com.pixel.transitions.BaseTransition;
   import flash.events.IEventDispatcher;
   
   public class WipeTransitionUpOut extends BaseTransition
   {
      
      public function WipeTransitionUpOut(param1:String = "linear", param2:IEventDispatcher = null)
      {
         super(param1,param2);
      }
      
      override public function start(param1:int = 1000) : void
      {
         var _loc2_:Number = NaN;
         _loc2_ = -__boundingRect.height * 2;
         Tweener.addTween(__target,{
            "yP":_loc2_,
            "time":param1 / 1000,
            "transition":__easeType,
            "onComplete":transitionComplete
         });
      }
   }
}

