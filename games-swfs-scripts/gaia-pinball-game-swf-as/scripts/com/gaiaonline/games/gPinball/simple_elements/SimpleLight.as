package com.gaiaonline.games.gPinball.simple_elements
{
   import flash.display.MovieClip;
   
   public class SimpleLight extends MovieClip
   {
      
      public function SimpleLight()
      {
         super();
         visible = false;
      }
      
      public function switchOn() : void
      {
         visible = true;
      }
      
      public function switchOff() : void
      {
         visible = false;
      }
   }
}

