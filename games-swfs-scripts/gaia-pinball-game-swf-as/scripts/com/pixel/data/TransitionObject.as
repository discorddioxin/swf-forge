package com.pixel.data
{
   import com.pixel.iterator.RandomIterator;
   import com.pixel.motion.TweenTypes;
   import com.pixel.transitions.explode.ExplodeTransitionIn;
   
   public class TransitionObject
   {
      
      public var easeType:String = TweenTypes.LINEAR;
      
      public var iterator:Class = RandomIterator;
      
      public var transition:Class = ExplodeTransitionIn;
      
      public var tweenDuration:int = 500;
      
      public function TransitionObject()
      {
         super();
      }
      
      public function debug() : void
      {
      }
   }
}

