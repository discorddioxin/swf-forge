package game_fla
{
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1589")]
   public dynamic class star_animation_405 extends MovieClip
   {
      
      public function star_animation_405()
      {
         super();
         addFrameScript(0,frame1,18,frame19);
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame19() : *
      {
         gotoAndStop(1);
      }
   }
}

