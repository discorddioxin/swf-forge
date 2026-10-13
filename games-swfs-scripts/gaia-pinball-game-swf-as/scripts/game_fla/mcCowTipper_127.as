package game_fla
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1213")]
   public dynamic class mcCowTipper_127 extends MovieClip
   {
      
      public var graphic:MovieClip;
      
      public function mcCowTipper_127()
      {
         super();
         addFrameScript(0,frame1,6,frame7);
      }
      
      internal function frame7() : *
      {
         PinballCore.__Root.playSound("bull");
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

