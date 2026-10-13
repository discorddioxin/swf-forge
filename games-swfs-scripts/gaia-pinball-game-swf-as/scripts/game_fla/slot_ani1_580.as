package game_fla
{
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol25")]
   public dynamic class slot_ani1_580 extends MovieClip
   {
      
      public function slot_ani1_580()
      {
         super();
         addFrameScript(11,frame12,12,frame13);
      }
      
      internal function frame12() : *
      {
         gotoAndPlay(1);
      }
      
      internal function frame13() : *
      {
         stop();
      }
   }
}

