package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol559")]
   public dynamic class Flipper_Left extends Flipper
   {
      
      public function Flipper_Left()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

