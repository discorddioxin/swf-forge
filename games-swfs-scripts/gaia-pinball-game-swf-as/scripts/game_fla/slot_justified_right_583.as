package game_fla
{
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol33")]
   public dynamic class slot_justified_right_583 extends MovieClip
   {
      
      public var value:MovieClip;
      
      public function slot_justified_right_583()
      {
         super();
         addFrameScript(1,frame2,20,frame21,55,frame56);
      }
      
      internal function frame21() : *
      {
         gotoAndStop(1);
      }
      
      internal function frame2() : *
      {
         stop();
      }
      
      internal function frame56() : *
      {
         gotoAndPlay("BLINK");
      }
   }
}

