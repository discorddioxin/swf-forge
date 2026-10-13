package game_fla
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1172")]
   public dynamic class mcCowMoo_118 extends MovieClip
   {
      
      public function mcCowMoo_118()
      {
         super();
         addFrameScript(20,frame21,100,frame101);
      }
      
      internal function frame21() : *
      {
         PinballCore.__Root.playSound("moo");
      }
      
      internal function frame101() : *
      {
         stop();
      }
   }
}

