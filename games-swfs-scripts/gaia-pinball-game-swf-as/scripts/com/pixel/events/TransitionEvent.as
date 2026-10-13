package com.pixel.events
{
   import flash.events.Event;
   
   public class TransitionEvent extends Event
   {
      
      public static const SCENE_TRANSITION_COMPLETE:String = "sceneTransitionComplete";
      
      public static const TRANSITION_COMPLETE:String = "transitionComplete";
      
      public static const INTRO_TRANSITION_COMPLETE:String = "introTransitionComplete";
      
      public static const PAUSE_BEGUN:String = "pauseBegun";
      
      public static const PAUSE_COMPLETE:String = "pauseComplete";
      
      public static const OUTRO_TRANSITION_COMPLETE:String = "outroTransitionComplete";
      
      public static const TRANSITION_PAUSED:String = "transitionPaused";
      
      public static const TRANSITION_UNPAUSED:String = "transitionUnPaused";
      
      public var transitionId:String;
      
      public function TransitionEvent(param1:String, param2:Boolean = false, param3:Boolean = false)
      {
         super(param1,param2,param3);
      }
   }
}

