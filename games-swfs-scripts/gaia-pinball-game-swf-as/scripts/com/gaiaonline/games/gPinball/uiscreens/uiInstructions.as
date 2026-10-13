package com.gaiaonline.games.gPinball.uiscreens
{
   import com.gaiaonline.games.gPinball.Pinball;
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class uiInstructions extends MovieClip
   {
      
      public var startButton:MovieClip;
      
      public function uiInstructions()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function init(param1:Event) : void
      {
         removeEventListener("enterFrame",init);
         startButton.addEventListener("mouseDown",doStartClick,false,0,true);
      }
      
      public function doStartClick(param1:Event) : void
      {
         startButton.removeEventListener("mouseDown",doStartClick);
         (parent as Pinball).newGame();
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[InstructionsUI]",param1);
      }
   }
}

