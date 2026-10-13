package game_fla
{
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol453")]
   public dynamic class mcLaunchLights_303 extends MovieClip
   {
      
      public function mcLaunchLights_303()
      {
         super();
         addFrameScript(0,frame1,59,frame60,84,frame85);
      }
      
      internal function frame85() : *
      {
         gotoAndPlay("BLINK");
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame60() : *
      {
         gotoAndPlay("ON");
      }
   }
}

